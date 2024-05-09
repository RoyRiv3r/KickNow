//core code
let streamers = [];
let refreshInterval = 1;
let intervalId = null;

function ClearStreamer() {
  browser.runtime.onStartup.addListener(() => {
    browser.storage.local.get(null, (items) => {
      const keysToRemove = Object.keys(items).filter(
        (key) => key !== "notificationsEnabled" && key !== "refreshInterval"
      );
      browser.storage.local.remove(keysToRemove, () => {
        console.log("Streamers have been cleared after browser restart.");
      });
    });
  });
}

ClearStreamer();

browser.storage.local.get(null).then((items) => {
  streamers = Object.keys(items).filter(
    (streamer) =>
      streamer !== "notificationsEnabled" && streamer !== "refreshInterval"
  );
  setupRefreshInterval();
  startFetchingStreamers();
  console.log("Loaded streamers: ", streamers);
});

console.log("background.js script started, streamers:", streamers);

browser.runtime.onMessage.addListener((message, sender) => {
  console.log("Received message:", message.type, "from", sender);
  if (message.type === "addStreamer") {
    console.log("addStreamer message received. Streamer:", message.content);
    const streamerName = message.content.toLowerCase();
    if (streamers.includes(streamerName)) {
      return Promise.resolve({
        status: "error",
        error: "Streamer already exists",
      });
    }
    return fetchAndUpdateStreamer(streamerName)
      .then(() => {
        streamers.push(message.content);
        updateBadgeCount();
        console.log("After Adding - streamers:", streamers);
        return { status: "success" };
      })
      .catch((error) => {
        console.error("Error fetching and updating streamer:", error);
        return { status: "error", error: error.toString() };
      });
  } else if (message.type === "removeStreamer") {
    console.log("removeStreamer message received. Streamer:", message.content);
    const streamerName = message.content.toLowerCase();
    const index = streamers.indexOf(streamerName);
    if (index > -1) {
      streamers.splice(index, 1);
      return browser.storage.local.remove(streamerName).then(() => {
        updateBadgeCount();
        console.log("Removed streamer from local storage:", streamerName);
        return { status: "success" };
      });
    } else {
      return Promise.resolve({ status: "error", error: "Streamer not found" });
    }
  } else if (message.type === "refreshStreamers") {
    console.log("refreshStreamers message received.");
    clearInterval(intervalId);
    startFetchingStreamers();
    return { status: "success" };
  }
  if (message.type === "toggleStreamer") {
    const streamerName = message.content.toLowerCase();
    const index = streamers.indexOf(streamerName);
    if (index === -1) {
      return fetchAndUpdateStreamer(streamerName)
        .then(() => {
          streamers.push(streamerName);
          console.log("Streamer added:", streamerName);
          return { status: "success" };
        })
        .catch((error) => {
          console.error("Error adding streamer:", error);
          return { status: "error", error: error.toString() };
        });
    } else {
      streamers.splice(index, 1);
      console.log("Streamer removed:", streamerName);
      return browser.storage.local.remove(streamerName).then(() => {
        updateBadgeCount();
        console.log("Removed streamer from local storage:", streamerName);
        return { status: "success" };
      });
    }
  }
});

function fetchAndUpdateStreamer(streamer) {
  console.log("fetchAndUpdateStreamer called for:", streamer);
  return fetch(`https://kick.com/api/v2/channels/${streamer}`)
    .then((response) => {
      console.log("Fetch response for:", streamer, response);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Streamer not found");
        } else {
          throw new Error("Network response was not ok");
        }
      }
      return response.json();
    })
    .then((data) => {
      let exactUsername = data.user ? data.user.username : "";
      let slug = data.slug || "";
      let viewerCount =
        data.livestream && data.livestream.viewer_count
          ? data.livestream.viewer_count
          : 0;
      let isLive = data.livestream && data.livestream.is_live;
      let title = data.livestream ? data.livestream.session_title : "";
      let profilePic = data.user?.profile_pic ?? "user-profile-pic.png";
      let category = data.livestream?.categories?.[0]?.name ?? "Unknown";

      return browser.storage.local.get(streamer).then((storedData) => {
        let shouldNotify = false;
        if (storedData[streamer]) {
          if (!storedData[streamer].isLive && isLive) {
            shouldNotify = true;
          }
        } else {
          if (isLive) {
            shouldNotify = true;
          }
        }

        if (shouldNotify) {
          try {
            showNotification(slug, exactUsername, title, profilePic, category);
          } catch (error) {
            console.error("Error showing notification for streamer:", error);
          }
        }

        console.log("Data parsed for:", streamer, data);
        let streamerData = {
          exactUsername: exactUsername,
          slug: slug,
          isLive: isLive,
          profilePic: profilePic,
          category: category,
          title: title,
          viewer_count: viewerCount,
          liveTime: data.livestream
            ? calculateLiveTime(data.livestream.created_at)
            : null,
        };
        return browser.storage.local.set({ [streamer]: streamerData });
      });
    })
    .then(() => {
      updateBadgeCount();
    });
}

function calculateLiveTime(createdAt) {
  if (!createdAt) {
    return "00:00:00";
  }

  const start = new Date(createdAt + "Z");
  const now = new Date();

  const startUtc = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds()
  );
  const nowUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  );

  // Calculate the difference in milliseconds
  const diffMs = nowUtc - startUtc;

  const hours = Math.floor(diffMs / 3600000); // 1 hour = 3600000 milliseconds
  const minutes = Math.floor((diffMs % 3600000) / 60000); // 1 minute = 60000 milliseconds
  const seconds = Math.floor((diffMs % 60000) / 1000); // 1 second = 1000 milliseconds

  // Format the result to HH:MM:SS
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function showNotification(slug, exactUsername, title, profilePic, category) {
  var notificationOptions = {
    type: "basic",
    iconUrl: profilePic,
    title: `${exactUsername} is now live!`,
    message: `${category}\n${title}`,
  };
  browser.notifications.create(slug, notificationOptions).catch((error) => {
    console.error("Error creating notification:", error);
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
  streamers.forEach((streamer) => {
    fetchAndUpdateStreamer(streamer);
  });
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
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.refreshInterval) {
    refreshInterval = changes.refreshInterval.newValue;
    setupRefreshAlarm();
  }
});

function updateBadgeCount() {
  let liveCount = 0;
  const promises = [];
  for (let streamer of streamers) {
    const promise = browser.storage.local.get(streamer).then((data) => {
      if (data[streamer] && data[streamer].isLive) {
        liveCount++;
      }
    });
    promises.push(promise);
  }
  Promise.all(promises).then(() => {
    browser.browserAction.setBadgeText({ text: liveCount.toString() });
    browser.browserAction.setBadgeBackgroundColor({ color: "#706565" });
    browser.browserAction.setBadgeTextColor({ color: "#ffffff" });
  });
}
