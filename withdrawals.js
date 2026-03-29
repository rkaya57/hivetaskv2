import {
  auth, db, onAuthStateChanged, doc, getDoc, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp
} from "./firebase.js";

const POINTS_PER_TOKEN = 100;

const withdrawNotice = document.getElementById("withdrawNotice");
const withdrawForm = document.getElementById("withdrawForm");
const tokenAmountInput = document.getElementById("tokenAmount");
const pointAmountInput = document.getElementById("pointAmount");
const walletAddressInput = document.getElementById("walletAddress");
const withdrawNoteInput = document.getElementById("withdrawNote");
const historyList = document.getElementById("withdrawHistoryList");

const wUserName = document.getElementById("wUserName");
const wUserEmail = document.getElementById("wUserEmail");
const wPoints = document.getElementById("wPoints");
const wAvailableTokens = document.getElementById("wAvailableTokens");
const wPendingCount = document.getElementById("wPendingCount");
const paidCountLabel = document.getElementById("paidCountLabel");
const rejectedCountLabel = document.getElementById("rejectedCountLabel");
const totalWithdrawalCountLabel = document.getElementById("totalWithdrawalCountLabel");
const totalPaidTokenLabel = document.getElementById("totalPaidTokenLabel");
const pointsPerTokenLabel = document.getElementById("pointsPerTokenLabel");
const availablePointsLabel = document.getElementById("availablePointsLabel");
const availableTokenLabel = document.getElementById("availableTokenLabel");

let currentUser = null;
let currentPoints = 0;

function showNotice(message, type="") {
  withdrawNotice.textContent = message;
  withdrawNotice.className = `notice ${type}`.trim();
  withdrawNotice.classList.remove("hide");
}

function safe(v) { return v ? String(v) : ""; }

function recalc() {
  const tokenAmount = Number(tokenAmountInput.value || 0);
  const pointsNeeded = tokenAmount > 0 ? Math.ceil(tokenAmount * POINTS_PER_TOKEN) : 0;
  pointAmountInput.value = pointsNeeded || "";
}

tokenAmountInput?.addEventListener("input", recalc);

async function loadWithdrawals(userId) {
  const q = query(collection(db, "withdrawals"), where("userId", "==", userId));
  const snap = await getDocs(q);
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  items.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const pending = items.filter(x => x.status === "pending");
  const paid = items.filter(x => x.status === "paid");
  const rejected = items.filter(x => x.status === "rejected");

  wPendingCount.textContent = pending.length;
  paidCountLabel.textContent = paid.length;
  rejectedCountLabel.textContent = rejected.length;
  totalWithdrawalCountLabel.textContent = items.length;
  totalPaidTokenLabel.textContent = `${paid.reduce((s,x)=>s+Number(x.tokenAmount||0),0).toFixed(4)} THIVE`;

  if (!items.length) {
    historyList.innerHTML = '<div class="empty-state">Henüz çekim talebin yok.</div>';
    return;
  }

  historyList.innerHTML = items.map(item => {
    let statusClass = "review";
    let statusText = "Bekliyor";
    if (item.status === "paid") { statusClass = "live"; statusText = "Ödendi"; }
    if (item.status === "rejected") { statusClass = "closed"; statusText = "Reddedildi"; }
    if (item.status === "processing") { statusClass = "processing"; statusText = "İşleniyor"; }

    return `
      <div class="list-item withdraw-card">
        <div class="rank">₿</div>
        <div class="submission-content">
          <div class="task-title">${Number(item.tokenAmount || 0).toFixed(4)} THIVE</div>
          <div class="meta">
            <span>${Number(item.pointAmount || 0)} puan</span>
            <span>Cüzdan: ${safe(item.walletAddress)}</span>
          </div>
          <div class="muted submission-links">
            <strong style="color:#eef4ff">Durum:</strong> ${statusText}<br>
            <strong style="color:#eef4ff">Talep Notu:</strong> ${safe(item.note) || "-"}<br>
            <strong style="color:#eef4ff">TX Hash:</strong> ${item.txHash ? `<a href="${safe(item.txExplorerUrl || '#')}" target="_blank" rel="noopener noreferrer">${safe(item.txHash)}</a>` : "-"}<br>
            <strong style="color:#eef4ff">Gönderilen Cüzdan:</strong> ${safe(item.walletAddress)}<br>
            ${item.rejectReason ? `<strong style="color:#eef4ff">Red Nedeni:</strong> ${safe(item.rejectReason)}<br>` : ""}
          </div>
        </div>
        <div class="reward">
          <span class="status ${statusClass}">${statusText}</span>
        </div>
      </div>
    `;
  }).join("");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showNotice("Çekim talebi oluşturmak için giriş yapmalısın.", "error");
    return;
  }

  currentUser = user;
  pointsPerTokenLabel.textContent = POINTS_PER_TOKEN;

  const userSnap = await getDoc(doc(db, "users", user.uid));
  const u = userSnap.exists() ? userSnap.data() : {};
  currentPoints = Number(u.points || 0);

  wUserName.textContent = u.username || u.name || "Kullanıcı";
  wUserEmail.textContent = u.email || user.email;
  wPoints.textContent = currentPoints;
  wAvailableTokens.textContent = (currentPoints / POINTS_PER_TOKEN).toFixed(4);
  availablePointsLabel.textContent = currentPoints;
  availableTokenLabel.textContent = `${(currentPoints / POINTS_PER_TOKEN).toFixed(4)} THIVE`;

  await loadWithdrawals(user.uid);
});

withdrawForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) {
    showNotice("Önce giriş yapmalısın.", "error");
    return;
  }

  const walletAddress = walletAddressInput.value.trim();
  const tokenAmount = Number(tokenAmountInput.value || 0);
  const pointAmount = Math.ceil(tokenAmount * POINTS_PER_TOKEN);
  const note = withdrawNoteInput.value.trim();

  if (!walletAddress || tokenAmount <= 0) {
    showNotice("Cüzdan adresi ve geçerli bir token miktarı zorunludur.", "error");
    return;
  }

  if (pointAmount > currentPoints) {
    showNotice("Yetersiz puan bakiyesi. Daha düşük bir miktar gir.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "withdrawals"), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      walletAddress,
      tokenAmount,
      pointAmount,
      note,
      status: "pending",
      txHash: "",
      txExplorerUrl: "",
      rejectReason: "",
      createdAt: serverTimestamp()
    });

    withdrawForm.reset();
    pointAmountInput.value = "";
    showNotice("Çekim talebin admin paneline gönderildi.", "success");
    await loadWithdrawals(currentUser.uid);
  } catch (err) {
    showNotice("Çekim talebi gönderilemedi: " + err.message, "error");
  }
});
