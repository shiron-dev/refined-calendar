// Content script for Google Calendar Event Copier extension

// Function to format date and time
function formatDateTime(startDate: Date, endDate: Date): string {
  // Format: YYYY/MM/DD(曜日) HH:MM - HH:MM
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  
  const year = startDate.getFullYear();
  const month = (startDate.getMonth() + 1).toString().padStart(2, '0');
  const day = startDate.getDate().toString().padStart(2, '0');
  const dayOfWeek = days[startDate.getDay()];
  
  const startHour = startDate.getHours().toString().padStart(2, '0');
  const startMinute = startDate.getMinutes().toString().padStart(2, '0');
  
  const endHour = endDate.getHours().toString().padStart(2, '0');
  const endMinute = endDate.getMinutes().toString().padStart(2, '0');
  
  return `${year}/${month}/${day}(${dayOfWeek}) ${startHour}:${startMinute} - ${endHour}:${endMinute}`;
}

// Function to copy event details to clipboard
function copyEventDetails(): void {
  try {
    // Get event title - try multiple selectors as Google Calendar's DOM structure might vary
    let title = '';
    const titleSelectors = [
      '[data-tooltip="Title"]',
      '.rq9Vt',
      '.YAAWbe',
      '.zHQkBf'
    ];
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        title = element.textContent.trim();
        break;
      }
    }
    
    // If still not found, try to find by role
    if (!title) {
      const headingElements = document.querySelectorAll('[role="heading"]');
      for (const element of headingElements) {
        if (element.textContent) {
          title = element.textContent.trim();
          break;
        }
      }
    }
    
    // Get event location - try multiple approaches
    let location = '';
    const locationSelectors = [
      '[data-tooltip="Location"]',
      '.Jmftzc.gVNoLb.EiZ8Dd',
      '.Jmftzc.gVNoLb.LKeQwe'
    ];
    
    for (const selector of locationSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        location = element.textContent.trim();
        break;
      }
    }
    
    // Get calendar URL (current URL)
    const calendarUrl = window.location.href;
    
    // Get event date and time - try multiple approaches
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    // Try to extract dates from Google Calendar's data attributes first
    try {
      // Google Calendar often stores event data in data attributes or in the DOM
      // Look for elements with time data
      const timeElements = document.querySelectorAll('[data-start-time], [data-end-time], [data-datestart], [data-dateend]');
      
      for (const element of timeElements) {
        const startTimeAttr = element.getAttribute('data-start-time') || element.getAttribute('data-datestart');
        const endTimeAttr = element.getAttribute('data-end-time') || element.getAttribute('data-dateend');
        
        if (startTimeAttr && endTimeAttr) {
          startDate = new Date(startTimeAttr);
          endDate = new Date(endTimeAttr);
          
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            break;
          }
        }
      }
    } catch (e) {
      console.error('Error extracting dates from data attributes:', e);
    }
    
    // If data attributes didn't work, try to get dates from the page content
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      // Try to get dates from the page
      const dateTimeSelectors = [
        '[data-tooltip="Time"]',
        '.SLD4me',
        '.QGRmIf',
        '.hVDHke',  // Another possible time container
        '.ynRLnc'   // Another possible time container
      ];
      
      // Try to extract date information from various elements
      for (const selector of dateTimeSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element && element.textContent) {
            const dateTimeText = element.textContent.trim();
            
            try {
              // Check if there's a date in the URL (common in Google Calendar URLs)
              const urlParams = new URLSearchParams(window.location.search);
              let dateParam = urlParams.get('date');
              
              // If no date in URL, try to find it in the event ID
              if (!dateParam) {
                const eventIdParam = urlParams.get('eid');
                if (eventIdParam) {
                  // Sometimes event IDs contain date information
                  const dateMatch = eventIdParam.match(/(\d{4})(\d{2})(\d{2})/);
                  if (dateMatch) {
                    dateParam = dateMatch[0];
                  }
                }
              }
              
              if (dateParam) {
                // URL date format is typically YYYYMMDD
                const year = parseInt(dateParam.substring(0, 4));
                const month = parseInt(dateParam.substring(4, 6)) - 1; // JS months are 0-indexed
                const day = parseInt(dateParam.substring(6, 8));
                
                // Look for time in the element text - handle various formats
                // Format: 3:30 – 4:30pm or 15:30 – 16:30 or 3:30pm – 4:30pm
                const timeMatch = dateTimeText.match(/(\d{1,2}):(\d{2})(?:am|pm)?\s*(?:–|~|-)\s*(\d{1,2}):(\d{2})(?:am|pm)?/i);
                
                if (timeMatch) {
                  let startHour = parseInt(timeMatch[1]);
                  const startMinute = parseInt(timeMatch[2]);
                  let endHour = parseInt(timeMatch[3]);
                  const endMinute = parseInt(timeMatch[4]);
                  
                  // Check for AM/PM indicators
                  if (dateTimeText.toLowerCase().includes('pm') && startHour < 12) {
                    startHour += 12;
                  }
                  if (dateTimeText.toLowerCase().includes('pm') && endHour < 12) {
                    endHour += 12;
                  }
                  
                  startDate = new Date(year, month, day, startHour, startMinute);
                  endDate = new Date(year, month, day, endHour, endMinute);
                  
                  if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                    break;
                  }
                }
              }
            } catch (e) {
              console.error('Error parsing date from text:', e);
            }
          }
        }
        
        if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
          break;
        }
      }
    }
    
    // If we still couldn't extract the date/time, use current time as fallback
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      const now = new Date();
      startDate = now;
      endDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later as fallback
    }
    
    // Format the date and time
    const formattedDateTime = formatDateTime(startDate, endDate);
    
    // Format the text to copy exactly as requested
    const textToCopy = `件名: ${title || ''}
場所: ${location || ''}
カレンダーURL: ${calendarUrl}
日時: ${formattedDateTime}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        // Show success message
        const message = document.createElement('div');
        message.textContent = 'イベント情報をコピーしました！';
        message.style.position = 'fixed';
        message.style.bottom = '20px';
        message.style.right = '20px';
        message.style.backgroundColor = '#4285f4';
        message.style.color = 'white';
        message.style.padding = '10px 15px';
        message.style.borderRadius = '4px';
        message.style.zIndex = '9999';
        message.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        
        document.body.appendChild(message);
        
        // Remove the message after 3 seconds
        setTimeout(() => {
          document.body.removeChild(message);
        }, 3000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  } catch (error) {
    console.error('Error copying event details:', error);
  }
}

// Function to create and inject the copy button
function injectCopyButton(): void {
  // Check if we're on an event page or popup by looking for various indicators
  const isEventPage = 
    document.querySelector('[data-tooltip="Title"]') !== null ||
    document.querySelector('.YAAWbe') !== null ||
    document.querySelector('.zHQkBf') !== null ||
    document.querySelector('[role="dialog"]') !== null ||
    document.querySelector('[role="presentation"] [role="button"][aria-label*="Edit"]') !== null ||
    document.querySelector('[role="presentation"] [role="button"][aria-label*="Delete"]') !== null ||
    // Look for event details elements
    (document.querySelector('[data-tooltip="Time"]') !== null && 
     document.querySelector('[data-tooltip="Location"]') !== null);
  
  if (!isEventPage) return;
  
  // Check if button already exists
  if (document.getElementById('gcal-event-copy-btn')) return;
  
  // Create the button
  const copyButton = document.createElement('button');
  copyButton.id = 'gcal-event-copy-btn';
  copyButton.textContent = '予定をコピー';
  copyButton.style.backgroundColor = '#1a73e8';
  copyButton.style.color = 'white';
  copyButton.style.border = 'none';
  copyButton.style.borderRadius = '4px';
  copyButton.style.padding = '8px 16px';
  copyButton.style.margin = '8px';
  copyButton.style.cursor = 'pointer';
  copyButton.style.fontSize = '14px';
  copyButton.style.fontWeight = '500';
  copyButton.style.boxShadow = '0 1px 2px rgba(0,0,0,0.3)';
  
  // Add hover effect
  copyButton.addEventListener('mouseover', () => {
    copyButton.style.backgroundColor = '#1765cc';
  });
  
  copyButton.addEventListener('mouseout', () => {
    copyButton.style.backgroundColor = '#1a73e8';
  });
  
  // Add click event
  copyButton.addEventListener('click', copyEventDetails);
  
  // Try to find a suitable container for the button
  // Google Calendar has different layouts for different views, so we need to try multiple selectors
  const possibleContainers = [
    '.Tnsqdc',                 // Common container in event popups
    '.pPTZAe',                 // Another common container
    '.d29e1c',                 // Event details sidebar
    '.lFe10c',                 // Event popup footer
    '.CIy9F',                  // Event popup header
    '[role="dialog"] header',  // Dialog header
    '[role="dialog"] footer',  // Dialog footer
    '.SGWAac',                 // Another possible container
    '[role="dialog"] .uVccjd', // Another container in dialog
    '[role="dialog"] .I7OXgf', // Another container in dialog
    '.Wbs5sd',                 // Event edit view container
    // Look for containers with buttons
    '[role="dialog"] [role="button"]',
    // Look for any container with event details
    '[data-tooltip="Time"]',
    '[data-tooltip="Location"]'
  ];
  
  // Try each container selector
  let buttonInserted = false;
  
  // First try to find containers that are specifically for buttons
  for (const selector of possibleContainers) {
    const containers = document.querySelectorAll(selector);
    if (containers.length > 0) {
      // For button containers, try to find the parent that contains multiple buttons
      for (const container of containers) {
        // Check if this is a button element itself
        if (container.tagName === 'BUTTON' || 
            container.getAttribute('role') === 'button') {
          // If it's a button, get its parent
          const parent = container.parentElement;
          if (parent && parent.children.length > 1) {
            // If parent has multiple children, it's likely a button container
            parent.appendChild(copyButton);
            buttonInserted = true;
            break;
          }
        } else {
          // If it's a container, append the button
          container.appendChild(copyButton);
          buttonInserted = true;
          break;
        }
      }
      
      if (buttonInserted) break;
    }
  }
  
  // If no suitable container is found, try to insert after any button in the event dialog
  if (!buttonInserted) {
    const eventDialog = document.querySelector('[role="dialog"]');
    if (eventDialog) {
      const existingButtons = eventDialog.querySelectorAll('button, [role="button"]');
      if (existingButtons.length > 0) {
        const lastButton = existingButtons[existingButtons.length - 1];
        lastButton.parentNode?.insertBefore(copyButton, lastButton.nextSibling);
        buttonInserted = true;
      } else {
        // If still no suitable location, just append to the dialog
        eventDialog.appendChild(copyButton);
        buttonInserted = true;
      }
    }
  }
  
  // Last resort: Create a floating button
  if (!buttonInserted) {
    copyButton.style.position = 'fixed';
    copyButton.style.bottom = '20px';
    copyButton.style.right = '20px';
    copyButton.style.zIndex = '9999';
    document.body.appendChild(copyButton);
  }
}

// Function to observe DOM changes and inject button when event popup appears
function observeDOM(): void {
  // Create a MutationObserver to watch for changes in the DOM
  const observer = new MutationObserver((mutations) => {
    // Check if we need to inject the button
    injectCopyButton();
  });
  
  // Start observing the document body for DOM changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also try to inject the button immediately in case we're already on an event page
  injectCopyButton();
}

// Start the extension
function init(): void {
  console.log('Google Calendar Event Copier extension initialized');
  observeDOM();
}

// Initialize when the page is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}