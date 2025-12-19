/*
 * Smart Calendar – Outlook Add-in
 * Command handler for creating a calendar draft from an email
 */

/* global Office, fetch */

Office.onReady(() => {
  // Office.js is ready
});

function action(event) {
  const item = Office.context.mailbox.item;

  if (!item) {
    event.completed();
    return;
  }

  showStatus(item, "Analyzing email…");

  item.body.getAsync(Office.CoercionType.Text, async (result) => {
    if (result.status !== Office.AsyncResultStatus.Succeeded) {
      console.error("Smart Calendar: failed to read email body", result.error);
      showError(item, "Could not read email content.");
      event.completed();
      return;
    }

    const subject = item.subject || "";
    const body = (result.value || "").slice(0, 8000); // cap payload
    const timezone = guessTimezone() || "UTC";

    // Anchor time for relative phrases later (tomorrow/next Friday)
    const receivedAt =
      item.dateTimeCreated || item.dateTimeModified || new Date().toISOString();

    const payload = { subject, body, receivedAt, timezone };

    try {
      showStatus(item, "Contacting Smart Calendar service…");

      const resp = await fetch("http://localhost:8787/api/extract-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        console.error("Backend error:", resp.status, text);
        showError(item, `Backend error (${resp.status}).`);
        event.completed();
        return;
      }

      const proposal = await resp.json();

      // proposal.start/end are ISO strings from backend
      const start = new Date(proposal.start);
      const end = new Date(proposal.end);

      Office.context.mailbox.displayNewAppointmentForm({
        subject: proposal.title || subject || "Event",
        start,
        end,
        location: proposal.location || "TBD",
        body: body.slice(0, 2000),
      });

      showStatus(item, "Draft opened.");
      event.completed();
    } catch (e) {
      console.error("Smart Calendar fetch failed:", e);
      showError(item, "Could not reach backend (is it running?).");
      event.completed();
    }
  });
}

/* -------------------------------
   Helpers
-------------------------------- */

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

// Best-effort timezone guess without extra libraries.
// Later we can make this more accurate with mailbox settings / backend inference.
function guessTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

Office.actions.associate("action", action);
