// Troque aqui o número se for outro (DDI 55 + DDD + número, só dígitos)
const NUMERO = "5511963763299";
const zap = t => "https://wa.me/" + NUMERO + "?text=" + encodeURIComponent(t);

document.querySelectorAll("[data-zap]").forEach(a => {
  a.href = zap(a.dataset.zap);
  a.target = "_blank";
  a.rel = "noopener";
});

const nav = document.getElementById("nav"), menu = document.querySelector(".menu");
menu.addEventListener("click", () => {
  const aberto = nav.classList.toggle("aberto");
  menu.setAttribute("aria-expanded", aberto);
});
nav.addEventListener("click", e => { if (e.target.closest("a")) { nav.classList.remove("aberto"); menu.setAttribute("aria-expanded", false); } });

document.querySelectorAll(".aba").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll(".aba").forEach(x => x.setAttribute("aria-pressed", x === b));
  document.querySelectorAll(".card").forEach(c => c.hidden = b.dataset.f !== "todos" && c.dataset.c !== b.dataset.f);
}));

document.getElementById("ano").textContent = new Date().getFullYear();
