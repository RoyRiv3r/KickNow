// Constants for styling
const BUTTON_STYLES = {
  backgroundColor: "#53fc18",
  color: "black",
  border: "none",
  padding: ".300rem .25rem",
  textAlign: "center",
  textDecoration: "none",
  fontSize: ".750rem",
  lineHeight: "1.25",
  margin: "2px 1px",
  cursor: "pointer",
  borderRadius: "5px",
  display: "flex",
  alignItems: "center",
  fontWeight: "600",
  fontFamily: "inherit",
  transition: "background-color 0.3s, transform 0.3s",
};

const ADD_ALL_BUTTON_STYLES = {
  ...BUTTON_STYLES,
  padding: ".600rem .25rem",
  fontSize: ".850rem",
};

// Helper function to apply styles
function applyStyles(element, styles) {
  Object.assign(element.style, styles);
}

// Helper function to create a button
function createButton(text, className, styles) {
  const button = document.createElement("button");
  button.textContent = text;
  button.className = className;
  applyStyles(button, styles);
  return button;
}

// Function to add button to streamer usernames
function addButtonToStreamerUsernames() {
  const actionButtons = document.querySelectorAll(
    ".stream-username > span:nth-child(1)"
  );
  actionButtons.forEach((actionButton) => {
    if (
      !actionButton.nextElementSibling ||
      actionButton.nextElementSibling.className !== "streamer-button"
    ) {
      const url = window.location.href;
      const streamerName = url.split("/").pop();

      const button = createButton("", "streamer-button", BUTTON_STYLES);

      browser.storage.local.get(streamerName).then((result) => {
        button.textContent = result[streamerName]
          ? "Remove Streamer"
          : "Add Streamer";
      });

      button.addEventListener("click", () =>
        handleStreamerButtonClick(button, streamerName)
      );
      actionButton.parentNode.insertBefore(button, actionButton.nextSibling);
    }
  });
}

// Function to handle streamer button click
function handleStreamerButtonClick(button, streamerName) {
  const isAdding = button.textContent === "Add Streamer";
  button.textContent = isAdding ? "Remove Streamer" : "Add Streamer";

  browser.runtime.sendMessage({
    type: isAdding ? "addStreamer" : "removeStreamer",
    content: streamerName,
  });
}

// Function to create or remove "Add All Streamers" button
function updateAddAllStreamersButton() {
  const channelsElement = document.querySelector(
    'div[data-v-adccd6b9][class*="border-primary/100"]'
  );
  const streamerElements = document.querySelectorAll(
    "div[data-v-3e774179] > a"
  );
  const existingButton = document.querySelector(".add-all-streamers-button");

  // Check if we're on the Channels tab
  const isChannelsTab = channelsElement && streamerElements.length > 0;

  if (isChannelsTab && !existingButton) {
    // Create and add the button if we're on the Channels tab and the button doesn't exist
    const addAllStreamersButton = createButton(
      "Add All Streamers",
      "add-all-streamers-button",
      ADD_ALL_BUTTON_STYLES
    );
    addAllStreamersButton.addEventListener("click", handleAddAllStreamersClick);
    channelsElement.parentNode.insertBefore(
      addAllStreamersButton,
      channelsElement.nextSibling
    );
  } else if (!isChannelsTab && existingButton) {
    // Remove the button if we're not on the Channels tab and the button exists
    existingButton.remove();
  }
}

// Function to handle "Add All Streamers" button click
function handleAddAllStreamersClick() {
  const streamerElements = document.querySelectorAll(
    "div[data-v-3e774179] > a"
  );

  if (streamerElements.length === 0) {
    showNotification(
      "No streamers found. Please make sure you're on the Channels tab."
    );
    return;
  }

  const streamerNames = Array.from(streamerElements).map((element) =>
    element.getAttribute("href").slice(1)
  );

  Promise.all(
    streamerNames.map((streamerName) =>
      browser.runtime.sendMessage({
        type: "addStreamer",
        content: streamerName,
      })
    )
  )
    .then((responses) => {
      const addedCount = responses.filter(
        (response) => response.status === "success"
      ).length;
      const alreadyAddedCount = responses.filter(
        (response) => response.status === "alreadyAdded"
      ).length;

      if (addedCount > 0) {
        showNotification(`${addedCount} streamer(s) added!`);
      } else if (alreadyAddedCount === streamerNames.length) {
        showNotification("All streamers were already added.");
      } else {
        showNotification(
          "No new streamers added. Please refresh the page and ensure you're on the Channels tab."
        );
      }
    })
    .catch((error) => {
      console.error("Error adding streamers:", error);
      showNotification("An error occurred while adding streamers.");
    });
}

// Function to show notification
function showNotification(message) {
  browser.runtime.sendMessage({ type: "showNotification", content: message });
}

// Initialize the script
function init() {
  updateAddAllStreamersButton();
  addButtonToStreamerUsernames();

  const observer = new MutationObserver(() => {
    updateAddAllStreamersButton();
    addButtonToStreamerUsernames();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

init();
