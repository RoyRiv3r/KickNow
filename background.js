// Background.js
// Debug configuration
let DEBUG = false;

// Debug function
const debug = (...args) => {
  if (DEBUG) {
    console.log(...args);
  }
};

// Core variables
let streamers = [];
let refreshInterval = 1;
let intervalId = null;

// Clear streamers on browser startup
browser.runtime.onStartup.addListener(() => {
  debug("Browser started. Clearing streamers...");
  browser.storage.local.get(null).then((items) => {
    const keysToRemove = Object.keys(items).filter(
      (key) => key !== "notificationsEnabled" && key !== "refreshInterval"
    );
    browser.storage.local.remove(keysToRemove).then(() => {
      debug("Streamers have been cleared after browser restart.");
    });
  });
});

// Initialize streamers and setup
browser.storage.local.get(null).then((items) => {
  streamers = Object.keys(items).filter(
    (streamer) =>
      streamer !== "notificationsEnabled" && streamer !== "refreshInterval"
  );
  setupRefreshInterval();
  startFetchingStreamers();
  debug("Loaded streamers:", streamers);
});

debug("background.js script started, streamers:", streamers);

// Message listener
browser.runtime.onMessage.addListener((message, sender) => {
  debug("Received message:", message.type, "from", sender);
  switch (message.type) {
    case "addStreamer":
      return handleAddStreamer(message.content);
    case "removeStreamer":
      return handleRemoveStreamer(message.content);
    case "refreshStreamers":
      return handleRefreshStreamers();
    case "toggleStreamer":
      return handleToggleStreamer(message.content);
    default:
      return Promise.resolve({
        status: "error",
        error: "Unknown message type",
      });
  }
});

function handleAddStreamer(streamerName) {
  debug("addStreamer message received. Streamer:", streamerName);
  streamerName = streamerName.toLowerCase();
  if (streamers.includes(streamerName)) {
    return Promise.resolve({
      status: "error",
      error: "Streamer already exists",
    });
  }
  return fetchAndUpdateStreamer(streamerName)
    .then(() => {
      streamers.push(streamerName);
      updateBadgeCount();
      debug("After Adding - streamers:", streamers);
      return { status: "success" };
    })
    .catch((error) => {
      debug("Error fetching and updating streamer:", error);
      return { status: "error", error: error.toString() };
    });
}

function handleRemoveStreamer(streamerName) {
  debug("removeStreamer message received. Streamer:", streamerName);
  streamerName = streamerName.toLowerCase();
  const index = streamers.indexOf(streamerName);
  if (index > -1) {
    streamers.splice(index, 1);
    return browser.storage.local.remove(streamerName).then(() => {
      updateBadgeCount();
      debug("Removed streamer from local storage:", streamerName);
      return { status: "success" };
    });
  } else {
    return Promise.resolve({ status: "error", error: "Streamer not found" });
  }
}

function handleRefreshStreamers() {
  debug("refreshStreamers message received.");
  clearInterval(intervalId);
  startFetchingStreamers();
  return Promise.resolve({ status: "success" });
}

function handleToggleStreamer(streamerName) {
  streamerName = streamerName.toLowerCase();
  const index = streamers.indexOf(streamerName);
  if (index === -1) {
    return fetchAndUpdateStreamer(streamerName)
      .then(() => {
        streamers.push(streamerName);
        debug("Streamer added:", streamerName);
        return { status: "success" };
      })
      .catch((error) => {
        debug("Error adding streamer:", error);
        return { status: "error", error: error.toString() };
      });
  } else {
    streamers.splice(index, 1);
    debug("Streamer removed:", streamerName);
    return browser.storage.local.remove(streamerName).then(() => {
      updateBadgeCount();
      debug("Removed streamer from local storage:", streamerName);
      return { status: "success" };
    });
  }
}

function fetchAndUpdateStreamer(streamer) {
  debug("fetchAndUpdateStreamer called for:", streamer);
  return fetch(`https://kick.com/api/v2/channels/${streamer}`)
    .then(handleResponse)
    .then((data) => processStreamerData(streamer, data))
    .then(updateBadgeCount)
    .catch((error) => {
      debug("Error in fetchAndUpdateStreamer:", error);
      throw error;
    });
}

function handleResponse(response) {
  debug("Fetch response:", response);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Streamer not found");
    } else {
      throw new Error("Network response was not ok");
    }
  }
  return response.json();
}

function processStreamerData(streamer, data) {
  let streamerData = extractStreamerData(data);
  return browser.storage.local.get(streamer).then((storedData) => {
    let shouldNotify = checkNotification(storedData[streamer], streamerData);
    if (shouldNotify) {
      showNotification(streamerData);
    }
    return browser.storage.local.set({ [streamer]: streamerData });
  });
}

function extractStreamerData(data) {
  return {
    exactUsername: data.user ? data.user.username : "",
    slug: data.slug || "",
    isLive: data.livestream && data.livestream.is_live,
    profilePic: data.user?.profile_pic ?? "user-profile-pic.png",
    category: data.livestream?.categories?.[0]?.name ?? "Unknown",
    title: data.livestream ? data.livestream.session_title : "",
    viewer_count:
      data.livestream && data.livestream.viewer_count
        ? data.livestream.viewer_count
        : 0,
    liveTime: data.livestream ? data.livestream.created_at : null,
  };
}

function checkNotification(storedData, newData) {
  return (
    (!storedData && newData.isLive) ||
    (storedData && !storedData.isLive && newData.isLive)
  );
}

function calculateLiveTime(createdAt) {
  if (!createdAt) return "00:00:00";
  const start = new Date(createdAt + "Z");
  const now = new Date();
  const diffMs = now - start;
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function showNotification(streamerData) {
  const notificationOptions = {
    type: "basic",
    iconUrl: streamerData.profilePic,
    title: `${streamerData.exactUsername} is now live!`,
    message: `${streamerData.category}\n${streamerData.title}`,
  };
  browser.notifications
    .create(streamerData.slug, notificationOptions)
    .catch((error) => {
      debug("Error creating notification:", error);
    });
}

browser.notifications.onClicked.addListener((notificationId) => {
  browser.storage.local.get(notificationId.toLowerCase()).then((data) => {
    if (data[notificationId.toLowerCase()]) {
      const slug = data[notificationId.toLowerCase()].slug;
      browser.tabs.create({ url: `https://kick.com/${slug}` });
    }
  });
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refresh") {
    startFetchingStreamers();
  }
});

function startFetchingStreamers() {
  debug("Starting to fetch streamers...");
  streamers.forEach(fetchAndUpdateStreamer);
}

function setupRefreshInterval() {
  browser.storage.local.get("refreshInterval").then((result) => {
    refreshInterval = result.refreshInterval || 1;
    setupRefreshAlarm();
  });
}

function setupRefreshAlarm() {
  const interval = Number(refreshInterval);
  const validInterval = isNaN(interval) ? 1 : interval;
  browser.alarms.create("refresh", { periodInMinutes: validInterval });
  debug(`Refresh alarm set for every ${validInterval} minutes`);
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.refreshInterval) {
    refreshInterval = changes.refreshInterval.newValue;
    setupRefreshAlarm();
  }
});

function updateBadgeCount() {
  return Promise.all(
    streamers.map((streamer) =>
      browser.storage.local
        .get(streamer)
        .then((data) => data[streamer] && data[streamer].isLive)
    )
  ).then((results) => {
    const liveCount = results.filter(Boolean).length;
    browser.browserAction.setBadgeText({ text: liveCount.toString() });
    browser.browserAction.setBadgeBackgroundColor({ color: "#706565" });
    browser.browserAction.setBadgeTextColor({ color: "#ffffff" });
    debug(`Badge updated: ${liveCount} live streamers`);
  });
}

// Function to toggle debug mode
const toggleDebug = () => {
  DEBUG = !DEBUG;
  debug(`Debug mode ${DEBUG ? "enabled" : "disabled"}`);
};
