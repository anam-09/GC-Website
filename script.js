const PHONE_WA = "919823808054"; // Country code and number, without +
const nav = document.getElementById("nav");
const menu = document.getElementById("menu");
const burger = document.getElementById("burger");

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

document.getElementById("form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("status");
  const nameInput = form.elements.namedItem("name");
  const phoneInput = form.elements.namedItem("phone");
  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  nameInput.classList.toggle("err", !name);
  phoneInput.classList.toggle("err", !phone);
  if (!name || !phone) {
    status.textContent = "Please enter your name and phone number.";
    (!name ? nameInput : phoneInput).focus();
    return;
  }
  const message = `Hello Grand Cool, I need: ${form.elements.namedItem("service").value}.\nName: ${name}\nPhone: ${phone}\nArea: ${form.elements.namedItem("area").value.trim()}\n${form.elements.namedItem("msg").value.trim()}`;
  status.textContent = "Opening WhatsApp…";
  window.open(wa(message), "_blank", "noopener,noreferrer");
});

document.querySelectorAll(".enq").forEach(button => button.addEventListener("click", () => {
  const product = button.closest(".prod").dataset.model;
  window.open(wa(`Hello Grand Cool, I would like to enquire about: ${product}.`), "_blank", "noopener,noreferrer");
}));
