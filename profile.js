import {
  auth, db, onAuthStateChanged, doc, getDoc, collection, getDocs, query, where
} from "./firebase.js";

const noticeEl = document.getElementById("profileNotice");
const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileBadge = document.getElementById("profileBadge");
const profilePoints = document.getElementById("profilePoints");
const profilePaidTokens = document.getElementById("profilePaidTokens");
const profileSuccessRate = document.getElementById("profileSuccessRate");
const sideProfileName = document.getElementById("sideProfileName");
const sideProfileEmail = document.getElementById("sideProfileEmail");
const sideProfileBadge = document.getElementById("sideProfileBadge");
const badgeMetaText = document.getElementById("badgeMetaText");
const approvedMetaCount = document.getElementById("approvedMetaCount");
const paymentMetaCount = document.getElementById("paymentMetaCount");
const profileApprovedCount = document.getElementById("profileApprovedCount");
const profilePendingCount = document.getElementById("profilePendingCount");
const profileRejectedCount = document.getElementById("profileRejectedCount");
const profileWithdrawalCount = document.getElementById("profileWithdrawalCount");
const profileRecentApproved = document.getElementById("profileRecentApproved");
const profileRecentPayments = document.getElementById("profileRecentPayments");
const profileSubmissionHistory = document.getElementById("profileSubmissionHistory");

function showNotice(message, type="") {
  noticeEl.textContent = message;
  noticeEl.className = `notice ${type}`.trim();
  noticeEl.classList.remove("hide");
}
function safe(v) { return v ? String(v) : ""; }

function badgeFromPoints(points) {
  if (points >= 10000) return "Gold Hive";
  if (points >= 7500) return "Silver Hive";
  if (points >= 3000) return "Builder";
  if (points >= 1000) return "Rising";
  return "Newbie";
}
function statusUI(status) {
  if (status === "approved") return { cls: "live", text: "Onaylandı" };
  if (status === "rejected") return { cls: "closed", text: "Reddedildi" };
  return { cls: "review", text: "Bekliyor" };
}
async function getTaskTitle(taskId) {
  try {
    const snap = await getDoc(doc(db, "tasks", taskId));
    return snap.exists() ? (snap.data().title || taskId) : taskId;
  } catch { return taskId; }
}

function renderApproved(items) {
  if (!items.length) {
    profileRecentApproved.innerHTML = '<div class="empty-state">Henüz onaylanan görevin yok.</div>';
    return;
  }
  profileRecentApproved.innerHTML = items.map(item => `
    <div class="list-item">
      <div class="rank">✓</div>
      <div>
        <div class="task-title">${safe(item.taskTitle)}</div>
        <div class="meta"><span>${safe(item.xUsername || "-")}</span><span>${safe(item.userEmail || "-")}</span></div>
      </div>
      <div class="reward"><span class="status live">Onaylandı</span></div>
    </div>
  `).join("");
}

function renderPayments(items) {
  if (!items.length) {
    profileRecentPayments.innerHTML = '<div class="empty-state">Henüz ödeme geçmişin yok.</div>';
    return;
  }
  profileRecentPayments.innerHTML = items.map(item => `
    <div class="list-item">
      <div class="rank">₿</div>
      <div>
        <div class="task-title">${Number(item.tokenAmount || 0).toFixed(4)} THIVE</div>
        <div class="meta"><span>${Number(item.pointAmount || 0)} puan</span><span>${safe(item.walletAddress)}</span></div>
      </div>
      <div class="reward"><span class="status ${item.status === "paid" ? "live" : item.status === "rejected" ? "closed" : "review"}">${item.status === "paid" ? "Ödendi" : item.status === "rejected" ? "Reddedildi" : "Bekliyor"}</span></div>
    </div>
  `).join("");
}

function renderHistory(items) {
  if (!items.length) {
    profileSubmissionHistory.innerHTML = '<div class="empty-state">Henüz submission geçmişin yok.</div>';
    return;
  }
  profileSubmissionHistory.innerHTML = items.map(item => {
    const ui = statusUI(item.status);
    const reason = item.status === "rejected" && item.rejectedReason
      ? `<div style="margin-top:8px;color:#ffc9d3"><strong>Red Nedeni:</strong> ${safe(item.rejectedReason)}</div>`
      : "";
    return `
      <div class="list-item submission-card">
        <div class="rank">#</div>
        <div class="submission-content">
          <div class="task-title">${safe(item.taskTitle)}</div>
          <div class="meta"><span>X: ${safe(item.xUsername || "-")}</span><span>${safe(item.userEmail || "-")}</span></div>
          <div class="muted submission-links">
            <strong style="color:#eef4ff">X Profil:</strong> ${item.xProfileLink ? `<a href="${safe(item.xProfileLink)}" target="_blank" rel="noopener noreferrer">${safe(item.xProfileLink)}</a>` : "-"}<br>
            <strong style="color:#eef4ff">Ekran Görüntüsü:</strong> ${item.screenshotLink ? `<a href="${safe(item.screenshotLink)}" target="_blank" rel="noopener noreferrer">${safe(item.screenshotLink)}</a>` : "-"}<br>
            <strong style="color:#eef4ff">Ek Kanıt:</strong> ${item.proof ? `<a href="${safe(item.proof)}" target="_blank" rel="noopener noreferrer">${safe(item.proof)}</a>` : "-"}<br>
            <strong style="color:#eef4ff">Not:</strong> ${safe(item.note) || "-"}
            ${reason}
          </div>
        </div>
        <div class="reward"><span class="status ${ui.cls}">${ui.text}</span></div>
      </div>
    `;
  }).join("");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showNotice("Profili görüntülemek için giriş yapmalısın.", "error");
    return;
  }

  const userSnap = await getDoc(doc(db, "users", user.uid));
  const u = userSnap.exists() ? userSnap.data() : {};
  const points = Number(u.points || 0);
  const badge = badgeFromPoints(points);
  const name = u.username || u.name || user.email || "Kullanıcı";

  profileAvatar.textContent = name[0]?.toUpperCase() || "T";
  profileName.textContent = name;
  profileEmail.textContent = u.email || user.email;
  profileBadge.textContent = badge;
  profilePoints.textContent = points;
  sideProfileName.textContent = name;
  sideProfileEmail.textContent = u.email || user.email;
  sideProfileBadge.textContent = `Rozet: ${badge}`;
  badgeMetaText.textContent = badge;

  const subSnap = await getDocs(query(collection(db, "submissions"), where("userId", "==", user.uid)));
  const submissions = [];
  for (const d of subSnap.docs) {
    const data = d.data();
    const taskTitle = await getTaskTitle(data.taskId);
    submissions.push({ id: d.id, ...data, taskTitle });
  }
  submissions.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const approved = submissions.filter(x => x.status === "approved");
  const pending = submissions.filter(x => x.status === "pending");
  const rejected = submissions.filter(x => x.status === "rejected");

  profileApprovedCount.textContent = approved.length;
  profilePendingCount.textContent = pending.length;
  profileRejectedCount.textContent = rejected.length;
  approvedMetaCount.textContent = `${approved.length} görev`;

  const total = submissions.length;
  const successRate = total ? Math.round((approved.length / total) * 100) : 0;
  profileSuccessRate.textContent = `%${successRate}`;

  const wSnap = await getDocs(query(collection(db, "withdrawals"), where("userId", "==", user.uid)));
  const withdrawals = wSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const paid = withdrawals.filter(x => x.status === "paid");
  const totalPaid = paid.reduce((sum, x) => sum + Number(x.tokenAmount || 0), 0);

  profilePaidTokens.textContent = `${totalPaid.toFixed(4)} THIVE`;
  profileWithdrawalCount.textContent = withdrawals.length;
  paymentMetaCount.textContent = `${paid.length} ödeme`;

  renderApproved(approved.slice(0, 5));
  renderPayments(withdrawals.slice(0, 5));
  renderHistory(submissions);
});
