function addButtonToStreamerUsernames() {
  const actionButtons = document.querySelectorAll(
    ".stream-username > span:nth-child(1)"
  );
  actionButtons.forEach((actionButton) => {
    if (
      !actionButton.nextElementSibling ||
      actionButton.nextElementSibling.className !== "streamer-button"
    ) {
      const button = document.createElement("button");
      button.className = "streamer-button";

      button.style.backgroundColor = "#53fc18";
      button.style.color = "black";
      button.style.border = "none";
      button.style.padding = ".300rem .25rem";
      button.style.textAlign = "center";
      button.style.textDecoration = "none";
      button.style.fontSize = ".750rem";
      button.style.lineHeight = "1.25";
      button.style.margin = "2px 1px";
      button.style.cursor = "pointer";
      button.style.borderRadius = "5px";
      button.style.display = "flex";
      button.style.alignItems = "center";
      button.style.fontWeight = "600";
      button.style.fontFamily = "inherit";
      button.style.transition = "background-color 0.3s, transform 0.3s";

      // const streamerName = actionButton.textContent.trim().toLowerCase();
      const url = window.location.href;
      const streamerName = url.split("/").pop();

      browser.storage.local.get(streamerName).then((result) => {
        if (result[streamerName]) {
          button.textContent = "Remove Streamer";
        } else {
          button.textContent = "Add Streamer";
        }
      });

      button.addEventListener("click", function () {
        if (button.textContent === "Add Streamer") {
          button.textContent = "Remove Streamer";
          browser.runtime.sendMessage({
            type: "addStreamer",
            content: streamerName,
          });
        } else {
          button.textContent = "Add Streamer";
          browser.runtime.sendMessage({
            type: "removeStreamer",
            content: streamerName,
          });
        }
      });

      actionButton.parentNode.insertBefore(button, actionButton.nextSibling);
    }
  });
}

function createAddAllStreamersButton() {
  const channelsElement = document.querySelector(
    'div[data-v-adccd6b9][class*="border-primary/100"]'
  );
  if (channelsElement) {
    const existingButton = document.querySelector(".add-all-streamers-button");
    if (!existingButton) {
      const addAllStreamersButton = document.createElement("button");
      addAllStreamersButton.textContent = "Add All Streamers";
      addAllStreamersButton.className = "add-all-streamers-button";

      addAllStreamersButton.style.backgroundColor = "#53fc18";
      addAllStreamersButton.style.color = "black";
      addAllStreamersButton.style.border = "none";
      addAllStreamersButton.style.padding = ".600rem .25rem";
      addAllStreamersButton.style.textAlign = "center";
      addAllStreamersButton.style.textDecoration = "none";
      addAllStreamersButton.style.fontSize = ".850rem";
      addAllStreamersButton.style.lineHeight = "1.25";
      addAllStreamersButton.style.margin = "2px 1px";
      addAllStreamersButton.style.cursor = "pointer";
      addAllStreamersButton.style.borderRadius = "5px";
      addAllStreamersButton.style.display = "flex";
      addAllStreamersButton.style.alignItems = "center";
      addAllStreamersButton.style.fontWeight = "600";
      addAllStreamersButton.style.fontFamily = "inherit";
      addAllStreamersButton.style.transition =
        "background-color 0.3s, transform 0.3s";

      addAllStreamersButton.addEventListener(
        "click",
        handleAddAllStreamersClick
      );
      channelsElement.parentNode.insertBefore(
        addAllStreamersButton,
        channelsElement.nextSibling
      );
    }
  }
}
function handleAddAllStreamersClick() {
  const streamerElements = document.querySelectorAll(
    "div[data-v-3e774179] > a"
  );
  const streamerNames = Array.from(streamerElements).map((element) =>
    element.getAttribute("href").slice(1)
  );

  const promises = streamerNames.map((streamerName) => {
    return browser.runtime.sendMessage({
      type: "addStreamer",
      content: streamerName,
    });
  });

  Promise.all(promises)
    .then((responses) => {
      const addedStreamers = responses.filter(
        (response) => response.status === "success"
      );
      const alreadyAddedStreamers = responses.filter(
        (response) => response.status === "alreadyAdded"
      );

      if (addedStreamers.length > 0) {
        showNotification("Streamers added!");
      } else if (alreadyAddedStreamers.length === streamerNames.length) {
        showNotification(
          "Something went wrong, try to refresh the page and make sure you are in Channels Tab."
        );
      }
    })
    .catch((error) => {
      console.error("Error adding streamers:", error);
    });
}

function showNotification(message) {
  browser.runtime.sendMessage({
    type: "showNotification",
    content: message,
  });
}

function init() {
  createAddAllStreamersButton();
  addButtonToStreamerUsernames();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        createAddAllStreamersButton();
        addButtonToStreamerUsernames();
      }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

init();
