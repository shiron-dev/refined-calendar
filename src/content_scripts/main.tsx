// Content script for Google Calendar Event Copier extension

// Function to format date and time
function formatDateTime(startDate: Date, endDate: Date): string {
  // Format: YYYY/MM/DD(曜日) HH:MM - HH:MM
  const days = ["日", "月", "火", "水", "木", "金", "土"];

  const year = startDate.getFullYear();
  const month = (startDate.getMonth() + 1).toString().padStart(2, "0");
  const day = startDate.getDate().toString().padStart(2, "0");
  const dayOfWeek = days[startDate.getDay()];

  const startHour = startDate.getHours().toString().padStart(2, "0");
  const startMinute = startDate.getMinutes().toString().padStart(2, "0");

  const endHour = endDate.getHours().toString().padStart(2, "0");
  const endMinute = endDate.getMinutes().toString().padStart(2, "0");

  return `${year}/${month}/${day}(${dayOfWeek}) ${startHour}:${startMinute} - ${endHour}:${endMinute}`;
}

// Function to copy event details to clipboard
function copyEventDetails(): void {
  try {
    // Get event title
    let title = "";
    // The event details are inside a dialog box
    const dialog = document.querySelector('div[role="dialog"]');
    if (dialog) {
      // The title is a heading inside the dialog.
      // Using role="heading" and aria-level="1" is more robust than using generated class names.
      const titleElement = dialog.querySelector(
        '[role="heading"][aria-level="1"]',
      );
      if (titleElement?.textContent) {
        title = titleElement.textContent.trim();
      }
    }

    // Get event location - try multiple approaches
    let location = "";
    const locationIconPath =
      "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 2.88-2.88 7.19-5 9.88C9.92 16.21 7 11.85 7 9z";
    const locationIcon = document.querySelector(`path[d="${locationIconPath}"]`);
    if (locationIcon) {
      const locationContainer = locationIcon.closest(".nBzcnc");
      if (locationContainer) {
        const locationLink = locationContainer.querySelector("a");
        if (locationLink) {
          location = locationLink.href;
        } else {
          const locationTextEl = locationContainer.querySelector(".toUqff");
          if (locationTextEl?.textContent) {
            location = locationTextEl.textContent.replace(/^場所: ?/, "").trim();
          }
        }
      }
    }

    if (!location) {
      const locationSelectors = [
        "[data-tooltip=\"Location\"]",
        ".Jmftzc.gVNoLb.EiZ8Dd",
        ".Jmftzc.gVNoLb.LKeQwe",
      ];

      for (const selector of locationSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          location = element.textContent.trim();
          break;
        }
      }
    }

    // Get calendar URL (current URL)
    const calendarUrl = window.location.href;

    // Get event date and time - try multiple approaches
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    // Try to extract date and time from the event dialog
    if (dialog) {
      // Look for the time information in the dialog
      const whenElement = dialog.querySelector("#xDetDlgWhen");
      if (whenElement?.textContent) {
        const timeText = whenElement.textContent.trim();

        try {
          // Format: "6月 23日 (月曜日)⋅午後10:00～10:30" or "June 23 (Monday) ⋅ 10:00 PM – 10:30 PM"
          const dateRegex =
            /(?:(\d+)月\s*(\d+)日)|(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d+))/;
          const dateMatch = timeText.match(dateRegex);

          const timeRegex =
            /(午前|午後|AM|PM)?\s*(\d{1,2}):(\d{2})\s*[～–-]\s*(午前|午後|AM|PM)?\s*(\d{1,2}):(\d{2})/;
          const timeMatch = timeText.match(timeRegex);

          if (dateMatch && timeMatch) {
            const monthMap: { [key: string]: number } = {
              January: 0,
              February: 1,
              March: 2,
              April: 3,
              May: 4,
              June: 5,
              July: 6,
              August: 7,
              September: 8,
              October: 9,
              November: 10,
              December: 11,
            };

            let month: number;
            let day: number;

            if (dateMatch[1] && dateMatch[2]) {
              // Japanese format: 6月 23日
              month = parseInt(dateMatch[1], 10) - 1;
              day = parseInt(dateMatch[2], 10);
            } else if (dateMatch[3] && dateMatch[4]) {
              // English format: June 23
              month = monthMap[dateMatch[3]];
              day = parseInt(dateMatch[4], 10);
            } else {
              // Should not happen if dateMatch is successful, but as a safeguard
              throw new Error(`Could not parse date from: ${timeText}`);
            }
            // Assume the current year. This might be wrong for events in a different year.
            const year = new Date().getFullYear();

            const [
              ,
              startAmPm,
              startHourStr,
              startMinuteStr,
              endAmPm,
              endHourStr,
              endMinuteStr,
            ] = timeMatch;

            let startHour = parseInt(startHourStr, 10);
            let endHour = parseInt(endHourStr, 10);

            if (
              (startAmPm === "午後" || startAmPm?.toUpperCase() === "PM") &&
              startHour < 12
            ) {
              startHour += 12;
            } else if (
              (startAmPm === "午前" || startAmPm?.toUpperCase() === "AM") &&
              startHour === 12
            ) {
              // 12 AM is 00:00
              startHour = 0;
            }

            if (
              (endAmPm === "午後" || endAmPm?.toUpperCase() === "PM") &&
              endHour < 12
            ) {
              endHour += 12;
            } else if (
              (endAmPm === "午前" || endAmPm?.toUpperCase() === "AM") &&
              endHour === 12
            ) {
              // 12 AM is 00:00
              // This logic assumes end time is on the same day.
              // For ranges like 10:00 PM - 12:30 AM, this needs more complex logic for date change.
              endHour = 0;
            } else if (
              !endAmPm &&
              (startAmPm === "午後" || startAmPm?.toUpperCase() === "PM") &&
              endHour < startHour
            ) {
              // Handle cases like "午後10:00～11:00" where end doesn't have PM.
              endHour += 12;
            }

            const startMinute = parseInt(startMinuteStr, 10);
            const endMinute = parseInt(endMinuteStr, 10);

            startDate = new Date(year, month, day, startHour, startMinute);
            endDate = new Date(year, month, day, endHour, endMinute);

            if (endDate < startDate) {
              endDate.setDate(endDate.getDate() + 1);
            }
          }
        } catch (e) {
          console.error("Error parsing date from dialog text:", e);
        }
      }
    }

    // If we still couldn't extract the date/time, use current time as fallback
    if (
      !startDate ||
      !endDate ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      const now = new Date();
      startDate = now;
      endDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later as fallback
    }

    // Format the date and time
    const formattedDateTime = formatDateTime(startDate, endDate);

    // Format the text to copy, excluding empty fields
    const details = [];
    if (title) {
      details.push(`件名: ${title}`);
    }
    if (location) {
      details.push(`場所: ${location}`);
    }
    details.push(`カレンダーURL: ${calendarUrl}`);
    details.push(`日時: ${formattedDateTime}`);

    const textToCopy = details.join("\n");

    // Copy to clipboard
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        // Show success message
        const message = document.createElement("div");
        message.textContent = "イベント情報をコピーしました！";
        message.style.position = "fixed";
        message.style.bottom = "20px";
        message.style.right = "20px";
        message.style.backgroundColor = "#4285f4";
        message.style.color = "white";
        message.style.padding = "10px 15px";
        message.style.borderRadius = "4px";
        message.style.zIndex = "9999";
        message.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";

        document.body.appendChild(message);

        // Remove the message after 3 seconds
        setTimeout(() => {
          document.body.removeChild(message);
        }, 3000);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  } catch (error) {
    console.error("Error copying event details:", error);
  }
}

// Function to create and inject the copy button
function injectCopyButton(): void {
  const dialog = document.querySelector('div[role="dialog"]');
  if (!dialog) {
    return;
  }

  // Check if button already exists
  if (document.getElementById("gcal-event-copy-btn")) {
    return;
  }

  const editIconPath =
    "M20.41 4.94l-1.35-1.35c-.78-.78-2.05-.78-2.83 0L3 16.82V21h4.18L20.41 7.77c.79-.78.79-2.05 0-2.83zm-14 14.12L5 19v-1.36l9.82-9.82 1.41 1.41-9.82 9.83z";
  const editIcon = dialog.querySelector(`path[d="${editIconPath}"]`);
  if (!editIcon) {
    return;
  }

  const editButton = editIcon.closest("button");
  if (!editButton) {
    return;
  }

  const copyButton = document.createElement("button");
  copyButton.id = "gcal-event-copy-btn";
  copyButton.className = editButton.className;
  copyButton.setAttribute("aria-label", "Copy event details");
  copyButton.setAttribute("data-use-native-focus-logic", "true");

  copyButton.innerHTML = `<span class="OiePBf-zPjgPe pYTkkf-Bz112c-UHGRz"></span><span class="RBHQF-ksKsZd"></span><span jsname="S5tZuc" aria-hidden="true" class="pYTkkf-Bz112c-kBDsod-Rtc0Jf"><span class="notranslate VfPpkd-kBDsod" aria-hidden="true"><svg focusable="false" width="20" height="20" viewBox="0 0 24 24" class="NMm5M"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path></svg></span></span><div class="pYTkkf-Bz112c-RLmnJb"></div>`;

  copyButton.addEventListener("mouseenter", () => {
    copyButton.style.backgroundColor = "rgba(60, 64, 67, 0.08)";
  });
  copyButton.addEventListener("mouseleave", () => {
    copyButton.style.backgroundColor = "transparent";
  });

  copyButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyEventDetails();
  });

  const wrapper = document.createElement("div");
  const editButtonContainer =
    editButton.parentElement?.parentElement?.parentElement;

  if (editButtonContainer?.parentElement) {
    // Insert the new button wrapper next to the edit button's wrapper.
    editButtonContainer.parentElement.insertBefore(
      wrapper,
      editButtonContainer.nextSibling,
    );
    wrapper.appendChild(copyButton);
  }
}

// Function to observe DOM changes and inject button when event popup appears
function observeDOM(): void {
  // Create a MutationObserver to watch for changes in the DOM
  const observer = new MutationObserver((_mutations) => {
    // Check if we need to inject the button
    injectCopyButton();
  });

  // Start observing the document body for DOM changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also try to inject the button immediately in case we're already on an event page
  injectCopyButton();
}

// Start the extension
function init(): void {
  console.warn("Google Calendar Event Copier extension initialized");
  observeDOM();
}

// Initialize when the page is fully loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
}
else {
  init();
}
