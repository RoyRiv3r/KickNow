function updateStreamerList() {
  browser.runtime
    .sendMessage({
      type: "refreshStreamers",
    })
    .then(() => {
      browser.storage.local
        .get(null)
        .then((items) => {
          let streamersList = document.getElementById("streamersList");
          streamersList.innerHTML = "";

          let sortedItems = Object.entries(items)
            .filter(
              ([streamer, streamerData]) =>
                streamer !== "notificationsEnabled" &&
                streamer !== "refreshInterval"
            )
            .sort(
              ([streamerA, streamerDataA], [streamerB, streamerDataB]) =>
                streamerDataB.isLive - streamerDataA.isLive
            );

          let isLive = true;

          for (let [streamer, streamerData] of sortedItems) {
            let li = document.createElement("li");
            let liveText = document.createElement("p");
            if (!streamerData.isLive) {
              li.classList.add("offline");
              liveText.classList.add("offline");
              if (isLive) {
                let hr = document.createElement("hr");
                streamersList.appendChild(hr);
                isLive = false;
              }
            }

            let a = document.createElement("a");
            a.href = `https://kick.com/${streamer}`;
            a.target = "_blank";
            let img = document.createElement("img");
            img.src = streamerData.profilePic;
            let streamerInfo = document.createElement("div");

            let exactUsername = streamerData.exactUsername || streamer;

            liveText.textContent = streamerData.isLive
              ? `${exactUsername}`
              : `${exactUsername} is offline`;
            liveText.style.fontWeight = "bold";
            liveText.style.fontSize = "15px";
            streamerInfo.appendChild(liveText);

            if (streamerData.isLive) {
              let title = document.createElement("p");
              title.id = "truncatedTitle";
              let truncatedTitle = streamerData.title;

              const maxWidth = 350;
              const categoryAndViewerCountWidth = 100;
              const padding = 10;
              const availableWidth =
                maxWidth - categoryAndViewerCountWidth - padding * 2;

              const titleWidth = getTextWidth(truncatedTitle, "13px Arial");

              if (titleWidth > availableWidth) {
                let truncatedWidth = 0;
                let truncatedChars = [];

                for (let char of truncatedTitle) {
                  const charWidth = getTextWidth(char, "13px Arial");
                  if (truncatedWidth + charWidth <= availableWidth) {
                    truncatedChars.push(char);
                    truncatedWidth += charWidth;
                  } else {
                    break;
                  }
                }

                truncatedTitle = truncatedChars.join("") + "...";
              }

              title.textContent = truncatedTitle;
              title.classList.add("title");
              title.title = streamerData.title;
              streamerInfo.appendChild(title);

              let categoryAndViewerCount = document.createElement("p");
              categoryAndViewerCount.className = "categoryAndViewerCount";

              let textNode = document.createTextNode(
                `${streamerData.category} - `
              );
              categoryAndViewerCount.appendChild(textNode);

              let viewerCountSpan = document.createElement("span");
              viewerCountSpan.className = "viewer-text";

              let statusIndicator = document.createElement("span");
              statusIndicator.className = "status-indicator";
              viewerCountSpan.appendChild(statusIndicator);

              let viewerCountText = document.createTextNode(
                `${streamerData.viewer_count}`
              );
              viewerCountSpan.appendChild(viewerCountText);

              categoryAndViewerCount.appendChild(viewerCountSpan);

              categoryAndViewerCount.style.fontSize = "12px";
              categoryAndViewerCount.style.color = "#aba6a6";
              streamerInfo.appendChild(categoryAndViewerCount);

              let liveTime = document.createElement("p");
              liveTime.textContent = streamerData.liveTime;
              liveTime.className = "live-time";
              streamerInfo.appendChild(liveTime);

              styleLiveStreamer(img, streamerInfo);
            }
            a.appendChild(img);
            a.appendChild(streamerInfo);
            li.appendChild(a);

            let removeButton = document.createElement("button");
            removeButton.textContent = "X";
            removeButton.title = "Remove";
            removeButton.addEventListener("click", () => {
              browser.runtime
                .sendMessage({
                  type: "removeStreamer",
                  content: streamer,
                })
                .then((response) => {
                  if (response.status === "success") {
                    updateStreamerList();
                  }
                });
            });

            li.appendChild(removeButton);
            streamersList.appendChild(li);
          }
        })
        .catch((error) => {
          console.error("Error getting data from storage:", error);
        });
    });
}

function getTextWidth(text, font) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}

function styleLiveStreamer(imgElement, imgContainer) {
  imgElement.classList.add("streamer-live-border");
}

document.getElementById("refreshInterval").addEventListener("input", (e) => {
  let refreshInterval = e.target.value;
  document.getElementById(
    "refreshIntervalDisplay"
  ).textContent = `${refreshInterval} min`;
  browser.storage.local
    .set({
      refreshInterval: refreshInterval,
    })
    .catch((error) => {
      console.error("Error setting refreshInterval in storage:", error);
    });
});

browser.storage.local
  .get("refreshInterval")
  .then((result) => {
    let refreshInterval = result.refreshInterval || "1";
    document.getElementById("refreshInterval").value = refreshInterval;
    document.getElementById(
      "refreshIntervalDisplay"
    ).textContent = `${refreshInterval} min`;
  })
  .catch((error) => {
    console.error("Error getting refreshInterval from storage:", error);
  });

document.getElementById("addStreamer").addEventListener("click", () => {
  const newStreamer = document
    .getElementById("newStreamer")
    .value.toLowerCase();
  if (newStreamer.trim()) {
    browser.runtime
      .sendMessage({
        type: "addStreamer",
        content: newStreamer,
      })
      .then((response) => {
        if (response.status === "error") {
          if (response.error === "Error: Streamer not found") {
            notify("Error", "Streamer does not exist");
          } else {
            notify("Error", "Streamer already in the list");
          }
        } else if (response.status === "success") {
          document.getElementById("newStreamer").value = "";

          let checkExist = setInterval(function () {
            browser.storage.local.get(newStreamer).then((result) => {
              if (result[newStreamer]) {
                updateStreamerList();
                clearInterval(checkExist);
              }
            });
          }, 100);
        }
      });
  }
});

function notify(title, message) {
  browser.notifications.create("error", {
    type: "basic",
    title: title,
    message: message,
    iconUrl: "error.png",
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

document.addEventListener("input", function (e) {
  if (e.target && e.target.id === "searchStreamer") {
    debounce(filterStreamers(e.target.value.toLowerCase()), 250);
  }
});

function filterStreamers(searchValue) {
  let streamerElements = document.querySelectorAll("#streamersList li");

  if (searchValue === "") {
    streamerElements.forEach(function (element) {
      element.style.display = "";
    });
  } else {
    streamerElements.forEach(function (element) {
      let streamerName = element.textContent.toLowerCase();
      if (streamerName.includes(searchValue)) {
        element.style.display = "";
      } else {
        element.style.display = "none";
      }
    });
  }
}

const newStreamerInput = document.getElementById("newStreamer");
const addButton = document.getElementById("addStreamer");
addButton.classList.add("green-button");

newStreamerInput.addEventListener("keyup", (event) => {
  if (event.key === "Enter") {
    addButton.click();
  }
});

document
  .getElementById("refresh")
  .addEventListener("click", updateStreamerList);

updateStreamerList();
