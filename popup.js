// popup.js
// Debug configuration
let DEBUG = false;

// Debug function
const debug = (...args) => {
  if (DEBUG) {
    console.log(...args);
  }
};

// Utility functions
const getTextWidth = (text, font) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = font;
  return context.measureText(text).width;
};

const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// DOM element references
const elements = {
  streamersList: document.getElementById("streamersList"),
  refreshInterval: document.getElementById("refreshInterval"),
  refreshIntervalDisplay: document.getElementById("refreshIntervalDisplay"),
  addStreamer: document.getElementById("addStreamer"),
  newStreamer: document.getElementById("newStreamer"),
  searchStreamer: document.getElementById("searchStreamer"),
  refresh: document.getElementById("refresh"),
};

// Main functions
const updateStreamerList = async () => {
  try {
    debug("Updating streamer list...");
    await browser.runtime.sendMessage({ type: "refreshStreamers" });
    const items = await browser.storage.local.get(null);

    const sortedStreamers = Object.entries(items)
      .filter(
        ([key]) => !["notificationsEnabled", "refreshInterval"].includes(key)
      )
      .sort(([, a], [, b]) => b.isLive - a.isLive);

    elements.streamersList.innerHTML = "";
    let isLive = true;

    sortedStreamers.forEach(([streamer, data]) => {
      const li = createStreamerListItem(streamer, data);
      if (isLive && !data.isLive) {
        elements.streamersList.appendChild(document.createElement("hr"));
        isLive = false;
      }
      elements.streamersList.appendChild(li);
    });
    debug("Streamer list updated successfully");
  } catch (error) {
    debug("Error updating streamer list:", error);
  }
};

const createStreamerListItem = (streamer, data) => {
  debug(`Creating list item for streamer: ${streamer}`);
  const li = document.createElement("li");
  li.classList.toggle("offline", !data.isLive);

  const a = document.createElement("a");
  a.href = `https://kick.com/${streamer}`;
  a.target = "_blank";

  const img = document.createElement("img");
  img.src = data.profilePic;
  if (data.isLive) img.classList.add("streamer-live-border");

  const streamerInfo = createStreamerInfo(streamer, data);

  a.append(img, streamerInfo);
  li.appendChild(a);

  const removeButton = createRemoveButton(streamer);
  li.appendChild(removeButton);

  return li;
};

const createStreamerInfo = (streamer, data) => {
  debug(`Creating streamer info for: ${streamer}`);
  const div = document.createElement("div");
  const exactUsername = data.exactUsername || streamer;

  const liveText = document.createElement("p");
  liveText.textContent = data.isLive
    ? exactUsername
    : `${exactUsername} is offline`;
  liveText.style.fontWeight = "bold";
  liveText.style.fontSize = "15px";
  liveText.classList.toggle("offline", !data.isLive);

  div.appendChild(liveText);

  if (data.isLive) {
    div.append(
      createTruncatedTitle(data.title),
      createCategoryAndViewerCount(data),
      createLiveTime(data.liveTime)
    );
  }

  return div;
};

const createTruncatedTitle = (title) => {
  debug(`Creating truncated title: ${title}`);
  const p = document.createElement("p");
  p.id = "truncatedTitle";
  p.classList.add("title");
  p.title = title;

  const maxWidth = 350;
  const categoryAndViewerCountWidth = 100;
  const padding = 10;
  const availableWidth = maxWidth - categoryAndViewerCountWidth - padding * 2;

  let truncatedTitle = title;
  if (getTextWidth(title, "13px Arial") > availableWidth) {
    truncatedTitle =
      title.split("").reduce((acc, char) => {
        return getTextWidth(acc + char, "13px Arial") <= availableWidth
          ? acc + char
          : acc;
      }, "") + "...";
  }

  p.textContent = truncatedTitle;
  return p;
};

const createCategoryAndViewerCount = (data) => {
  debug(`Creating category and viewer count for: ${data.category}`);
  const p = document.createElement("p");
  p.className = "categoryAndViewerCount";
  p.style.fontSize = "12px";
  p.style.color = "#aba6a6";

  // Create text nodes for the different parts
  const categoryText = document.createTextNode(`${data.category} - `);
  const spanViewerText = document.createElement("span");
  spanViewerText.className = "viewer-text";

  const spanStatusIndicator = document.createElement("span");
  spanStatusIndicator.className = "status-indicator";
  spanViewerText.appendChild(spanStatusIndicator);

  const viewerCountText = document.createTextNode(data.viewer_count);
  spanViewerText.appendChild(viewerCountText);

  // Append text nodes and spans to the paragraph
  p.appendChild(categoryText);
  p.appendChild(spanViewerText);

  return p;
};

const createLiveTime = (createdAt) => {
  debug(`Creating live time element for createdAt: ${createdAt}`);
  const p = document.createElement("p");
  p.className = "live-time";

  // Function to update the live time display
  const updateLiveTimeDisplay = () => {
    if (createdAt) {
      const start = new Date(createdAt + "Z");
      const now = new Date();
      const diffMs = now - start;
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      p.textContent = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    } else {
      p.textContent = "00:00:00";
    }
  };

  // Initial update
  updateLiveTimeDisplay();

  // Update every second
  setInterval(updateLiveTimeDisplay, 1000);

  return p;
};

const createRemoveButton = (streamer) => {
  debug(`Creating remove button for: ${streamer}`);
  const button = document.createElement("button");
  button.textContent = "X";
  button.title = "Remove";
  button.addEventListener("click", () => removeStreamer(streamer));
  return button;
};

const removeStreamer = async (streamer) => {
  try {
    debug(`Removing streamer: ${streamer}`);
    const response = await browser.runtime.sendMessage({
      type: "removeStreamer",
      content: streamer,
    });
    if (response.status === "success") {
      updateStreamerList();
    }
  } catch (error) {
    debug("Error removing streamer:", error);
  }
};

const updateRefreshInterval = (value) => {
  debug(`Updating refresh interval to: ${value} min`);
  elements.refreshIntervalDisplay.textContent = `${value} min`;
  browser.storage.local
    .set({ refreshInterval: value })
    .catch((error) =>
      debug("Error setting refreshInterval in storage:", error)
    );
};

const addNewStreamer = async () => {
  const newStreamer = elements.newStreamer.value.trim().toLowerCase();
  if (!newStreamer) return;

  try {
    debug(`Adding new streamer: ${newStreamer}`);
    const response = await browser.runtime.sendMessage({
      type: "addStreamer",
      content: newStreamer,
    });

    if (response.status === "error") {
      notify(
        "Error",
        response.error === "Error: Streamer not found"
          ? "Streamer does not exist"
          : "Streamer already in the list"
      );
    } else if (response.status === "success") {
      elements.newStreamer.value = "";
      await waitForStreamerData(newStreamer);
      updateStreamerList();
    }
  } catch (error) {
    debug("Error adding streamer:", error);
  }
};

const waitForStreamerData = (streamer) => {
  debug(`Waiting for streamer data: ${streamer}`);
  return new Promise((resolve) => {
    const checkExist = setInterval(async () => {
      const result = await browser.storage.local.get(streamer);
      if (result[streamer]) {
        clearInterval(checkExist);
        resolve();
      }
    }, 100);
  });
};

const notify = (title, message) => {
  debug(`Sending notification: ${title} - ${message}`);
  browser.notifications.create("error", {
    type: "basic",
    title,
    message,
    iconUrl: "error.png",
  });
};

const filterStreamers = (searchValue) => {
  debug(`Filtering streamers with search value: ${searchValue}`);
  const streamerElements = document.querySelectorAll("#streamersList li");
  streamerElements.forEach((element) => {
    const streamerName = element.textContent.toLowerCase();
    element.style.display =
      searchValue === "" || streamerName.includes(searchValue) ? "" : "none";
  });
};

// Event listeners
elements.refreshInterval.addEventListener("input", (e) =>
  updateRefreshInterval(e.target.value)
);
elements.addStreamer.addEventListener("click", addNewStreamer);
elements.newStreamer.addEventListener("keyup", (event) => {
  if (event.key === "Enter") elements.addStreamer.click();
});
elements.searchStreamer.addEventListener(
  "input",
  debounce((e) => filterStreamers(e.target.value.toLowerCase()), 250)
);
elements.refresh.addEventListener("click", updateStreamerList);

// Initialization
(async () => {
  try {
    debug("Initializing...");
    const { refreshInterval = "1" } = await browser.storage.local.get(
      "refreshInterval"
    );
    elements.refreshInterval.value = refreshInterval;
    updateRefreshInterval(refreshInterval);
  } catch (error) {
    debug("Error initializing refresh interval:", error);
  }
  updateStreamerList();
})();

// Function to toggle debug mode
const toggleDebug = () => {
  DEBUG = !DEBUG;
  debug(`Debug mode ${DEBUG ? "enabled" : "disabled"}`);
};
