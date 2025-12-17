/* global Office, document */

Office.onReady((info) => {
  if (info.host !== Office.HostType.Outlook) return;

  setStatus("Loaded.");
  hydrateEmailDetails();
});

function setStatus(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

function hydrateEmailDetails() {
  const item = Office.context.mailbox.item;

  document.getElementById("email-subject").textContent = item.subject || "—";

  const from =
    (item.from && (item.from.displayName || item.from.emailAddress)) || "—";
  document.getElementById("email-from").textContent = from;

  const received = item.dateTimeCreated || item.dateTimeModified || null;
  document.getElementById("email-received").textContent = received
    ? new Date(received).toLocaleString()
    : "—";
}
