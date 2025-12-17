/*
 * Smart Calendar – Outlook Add-in
 * Command handler for creating a calendar draft from an email
 */

/* global Office */

Office.onReady(() => {
  // Office.js is ready
});

/**
 * Ribbon command: Create calendar draft (basic mode)
 * @param {Office.AddinCommands.Event} event
 */

function action(event) {
  const item = Office.context.mailbox.item;

  if (!item) {
    event.completed();
    return;
  }

  showStatus(item, "Creating calendar draft…");

  item.body.getAsync(Office.CoercionType.Text, (result) => {
    if (result.status !== Office.AsyncResultStatus.Succeeded) {
      console.error("Smart Calendar: failed to read email body", result.error);
      showError(item, "Could not read email content.");
      event.completed();
      return;
    }

    const subject = item.subject || "Event";
    const body = result.value || "";

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    Office.context.mailbox.displayNewAppointmentForm({
      subject,
      start,
      end,
      location: "TBD",
      body: body.slice(0, 2000),
    });

    showStatus(item, "Calendar draft opened.");
    event.completed();
  });
}

function showStatus(item, message) {
  item.notificationMessages.replaceAsync("SmartCalendarStatus", {
    type: Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
    message: `Smart Calendar: ${message}`,
    icon: "Icon.80x80",
    persistent: false,
  });
}

function showError(item, message) {
  item.notificationMessages.replaceAsync("SmartCalendarStatus", {
    type: Office.MailboxEnums.ItemNotificationMessageType.ErrorMessage,
    message: `Smart Calendar: ${message}`,
  });
}

Office.actions.associate("action", action);
