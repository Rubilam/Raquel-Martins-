export const brl = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = iso => (iso ? iso.split("-").reverse().join("/") : "");
export const isoSP = d => d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // AAAA-MM-DD
export const hojeISO = () => isoSP(new Date());
export const soDigitos = s => (s || "").replace(/\D/g, "");

// Soma (ou subtrai) meses de um texto "AAAA-MM". Ex.: somaMes("2026-11", 1) = "2026-12"
export const somaMes = (ym, n = 1) => {
  let [a, m] = ym.split("-").map(Number);
  m += n;
  a += Math.floor((m - 1) / 12);
  m = (((m - 1) % 12) + 12) % 12 + 1;
  return `${a}-${String(m).padStart(2, "0")}`;
};

// Traduz erros comuns do banco para o português
export const msgErro = e => {
  if (e.code !== "23505") return e.message;
  if (e.message.includes("telefone")) return "Já existe um cliente com este telefone.";
  if (e.message.includes("jazigo")) return "Este túmulo (perpétua, rua e quadra) já está cadastrado.";
  if (e.message.includes("assinatura")) return "Este túmulo já tem uma mensalidade ativa.";
  return "Esse registro já existe.";
};
