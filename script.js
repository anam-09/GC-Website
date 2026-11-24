const PHONE_WA = "919823808054"; // Country code and number, without +
const BOOKING_API_URL = document.querySelector('meta[name="service-api-url"]')?.content.trim();

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

  const submitButton = bookingForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = "Submitting…";
  status.textContent = "Sending your enquiry. Please wait…";
  status.className = "form-status is-loading";

  try {
    const response = await fetch(BOOKING_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getBookingPayload())
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 400 && result.fields) {
      Object.entries(result.fields).forEach(([fieldName, message]) => {
        const field = bookingForm.elements.namedItem(fieldName);
        const error = document.getElementById(fieldErrors[fieldName]);
        if (field && error) {
          error.textContent = message;
          field.setAttribute("aria-invalid", "true");
        }
      });
      throw new Error("Please check the highlighted enquiry fields.");
    }
    if (!response.ok) throw new Error(result.error || "The enquiry could not be saved.");
    if (response.status !== 201 || result.status !== "saved" || !result.reference_number) {
      throw new Error("The server did not confirm a saved enquiry. Please contact us on WhatsApp.");
    }
    status.textContent = `Enquiry saved. Reference: ${result.reference_number}. This is not an appointment confirmation; our team will follow up.`;
    status.className = "form-status is-info";
  } catch (error) {
    status.textContent = error instanceof TypeError
      ? "Could not reach the booking API. No reference number was returned; contact us on WhatsApp if you need an immediate response."
      : error.message;
    status.className = "form-status is-error";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit Enquiry";
  }
});

document.querySelectorAll(".enq").forEach(button => button.addEventListener("click", () => {
  const product = button.closest(".prod").dataset.model;
  window.open(wa(`Hello Grand Cool, I would like to enquire about: ${product}.`), "_blank", "noopener,noreferrer");
}));
