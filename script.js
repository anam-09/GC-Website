const PHONE_WA = "919823808054"; // Country code and number, without +
const BOOKING_API_URL = null; // Add the Flask endpoint here when it is available.

const nav = document.getElementById("nav");
const menu = document.getElementById("menu");
const burger = document.getElementById("burger");
const bookingForm = document.getElementById("form");

document.getElementById("yr").textContent = new Date().getFullYear();

function closeMenu() {
  menu.classList.remove("open");
  burger.setAttribute("aria-expanded", "false");
  burger.setAttribute("aria-label", "Open navigation menu");
}

burger.addEventListener("click", () => {
  const open = burger.getAttribute("aria-expanded") !== "true";
  menu.classList.toggle("open", open);
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
});

menu.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeMenu();
});
document.addEventListener("click", event => {
  if (!nav.contains(event.target)) closeMenu();
});
addEventListener("resize", () => {
  if (innerWidth > 820) closeMenu();
});
addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 10), { passive: true });

const links = [...menu.querySelectorAll('a[href^="#"]')];
const sections = document.querySelectorAll("main section[id]");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    links.forEach(link => link.classList.toggle("on", link.getAttribute("href") === `#${entry.target.id}`));
  }), { rootMargin: "-35% 0px -55% 0px" });
  sections.forEach(section => observer.observe(section));
}

const wa = message => `https://wa.me/${PHONE_WA}?text=${encodeURIComponent(message)}`;
const defaultMessage = "Hello Grand Cool, I would like to enquire about your AC services.";
document.getElementById("wa").href = wa(defaultMessage);
document.getElementById("contact-wa").href = wa(defaultMessage);

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const dateField = bookingForm.elements.namedItem("preferred_date");
dateField.min = localDateString();

const fieldErrors = {
  name: "name-error",
  phone: "phone-error",
  service: "service-error",
  ac_type: "ac-type-error",
  area: "area-error",
  preferred_date: "date-error",
  description: "description-error"
};
const touchedFields = new Set();
const status = document.getElementById("status");

function validateField(field) {
  const value = field.value.trim();
  let message = "";

  if (field.required && !value) {
    message = "This field is required.";
  } else if (field.name === "phone" && value) {
    const normalized = value.replace(/[\s()-]/g, "");
    if (!/^(?:\+91|91|0)?[6-9]\d{9}$/.test(normalized)) {
      message = "Enter a valid 10-digit Indian mobile number.";
    }
  } else if (field.name === "preferred_date" && value && value < dateField.min) {
    message = "Choose today or a future date.";
  }

  const error = document.getElementById(fieldErrors[field.name]);
  error.textContent = message;
  field.setAttribute("aria-invalid", String(Boolean(message)));
  return !message;
}

const bookingFields = [...bookingForm.querySelectorAll("[name]")];
bookingFields.forEach(field => {
  field.addEventListener("blur", () => {
    touchedFields.add(field.name);
    validateField(field);
  });
  field.addEventListener("input", () => {
    if (touchedFields.has(field.name)) validateField(field);
    status.textContent = "";
    status.className = "form-status";
    updateBookingWhatsAppLink();
  });
  field.addEventListener("change", () => {
    if (touchedFields.has(field.name)) validateField(field);
    updateBookingWhatsAppLink();
  });
});

function getBookingPayload() {
  return Object.fromEntries(bookingFields.map(field => [field.name, field.value.trim()]));
}

function updateBookingWhatsAppLink() {
  const data = getBookingPayload();
  const hasDetails = Object.values(data).some(Boolean);
  const message = hasDetails
    ? `Hello Grand Cool, I would like to enquire about a service.\nName: ${data.name}\nPhone: ${data.phone}\nService: ${data.service}\nAC type: ${data.ac_type}\nArea: ${data.area}\nPreferred date: ${data.preferred_date}\nDetails: ${data.description}`
    : defaultMessage;
  document.getElementById("booking-wa").href = wa(message);
}

updateBookingWhatsAppLink();

bookingForm.addEventListener("submit", async event => {
  event.preventDefault();
  const invalidFields = bookingFields.filter(field => {
    touchedFields.add(field.name);
    return !validateField(field);
  });

  if (invalidFields.length) {
    status.textContent = "Please correct the highlighted fields. Nothing has been sent or saved.";
    status.className = "form-status is-error";
    invalidFields[0].focus();
    return;
  }

  if (!BOOKING_API_URL) {
    status.textContent = "Online booking is not connected. Your details have not been sent or saved. Use the separate WhatsApp button if you want to contact us.";
    status.className = "form-status is-info";
    return;
  }

  const submitButton = bookingForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  status.textContent = "Sending your request…";
  status.className = "form-status";

  try {
    const response = await fetch(BOOKING_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getBookingPayload())
    });
    if (!response.ok) throw new Error(`Booking API returned ${response.status}`);
    status.textContent = "Your request reached the server. This is not a confirmed booking; Grand Cool will follow up separately.";
    status.className = "form-status is-info";
  } catch (error) {
    status.textContent = "We could not send your request. Your details have not been confirmed; you can contact us using WhatsApp.";
    status.className = "form-status is-error";
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelectorAll(".enq").forEach(button => button.addEventListener("click", () => {
  const product = button.closest(".prod").dataset.model;
  window.open(wa(`Hello Grand Cool, I would like to enquire about: ${product}.`), "_blank", "noopener,noreferrer");
}));
