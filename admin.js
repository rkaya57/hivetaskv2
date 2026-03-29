import {
  auth, db, onAuthStateChanged, collection, addDoc, getDocs, query, orderBy,
  serverTimestamp, doc, getDoc, updateDoc, increment
} from "./firebase.js";

const form = document.getElementById("taskForm");
const taskNotice = document.getElementById("taskNotice");
const adminNotice = document.getElementById("adminNotice");
const tableBody = document.querySelector("#adminTable tbody");
const submissionsWrap = document.getElementById("submissionsWrap");
const withdrawAdminList = document.getElementById("withdrawAdminList");
const submissionFilters = document.getElementById("submissionFilters");

let currentUser = null;
let currentUserData = null;
let currentFilter = "all";
let cachedSubmissions = [];

function showTaskNotice(message, type="") {
  taskNotice.textContent = message;
  taskNotice.className = `notice ${type}`.trim();
  taskNotice.classList.remove("hide");
}

function showAdminNotice(message, type="") {
  adminNotice.textContent = message;
  adminNotice.className = `notice ${type}`.trim();
  adminNotice.classList.remove("hide");
}

function safe(v) {
  return v ? String(v) : "";
}

function isAdmin() {
  return currentUserData?.role === "admin";
}

function setFormDisabled(disabled) {
  if (!form) return;
  form.querySelectorAll("input, select, textarea, button").forEach(el => {
    el.disabled = disabled;
  });
}

async function loadTasks() {
  const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  tableBody.innerHTML = "";
  snap.forEach(docSnap => {
    const task = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${safe(task.title)}</td>
      <td>${safe(task.category)}</td>
      <td>${Number(task.reward || 0)} THP</td>
      <td>${safe(task.description)}</td>
      <td>${safe(task.deadline) || "-"}</td>
    `;
    tableBody.appendChild(tr);
  });
}

async function approveSubmission(submissionId) {
  if (!isAdmin()) {
    showAdminNotice("Bu işlem için admin yetkisi gerekli.", "error");
    return;
  }

  try {
    const subRef = doc(db, "submissions", submissionId);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) {
      showAdminNotice("Submission bulunamadı.", "error");
      return;
    }

    const submission = subSnap.data();
    if (submission.status === "approved") {
      showAdminNotice("Bu submission zaten onaylanmış.", "error");
      return;
    }

    const taskRef = doc(db, "tasks", submission.taskId);
    const taskSnap = await getDoc(taskRef);
    if (!taskSnap.exists()) {
      showAdminNotice("Göreve ait kayıt bulunamadı.", "error");
      return;
    }

    const reward = Number(taskSnap.data().reward || 0);
    const userRef = doc(db, "users", submission.userId);

    await updateDoc(subRef, {
      status: "approved",
      approvedAt: serverTimestamp(),
      rejectedReason: ""
    });

    await updateDoc(userRef, {
      points: increment(reward)
    });

    showAdminNotice(`Submission onaylandı. Kullanıcıya ${reward} THP eklendi.`, "success");
    await loadSubmissions();
    await loadWithdrawalsAdmin();
  } catch (err) {
    showAdminNotice("Onay işlemi başarısız: " + err.message, "error");
  }
}

async function rejectSubmission(submissionId) {
  if (!isAdmin()) {
    showAdminNotice("Bu işlem için admin yetkisi gerekli.", "error");
    return;
  }

  const reason = prompt("Red nedeni yaz:");
  if (reason === null) return;

  try {
    const subRef = doc(db, "submissions", submissionId);
    await updateDoc(subRef, {
      status: "rejected",
      rejectedAt: serverTimestamp(),
      rejectedReason: reason.trim()
    });
    showAdminNotice("Submission reddedildi.", "success");
    await loadSubmissions();
    await loadWithdrawalsAdmin();
  } catch (err) {
    showAdminNotice("Red işlemi başarısız: " + err.message, "error");
  }
}

async function fetchTaskTitle(taskId) {
  try {
    const tSnap = await getDoc(doc(db, "tasks", taskId));
    return tSnap.exists() ? (tSnap.data().title || taskId) : taskId;
  } catch {
    return taskId;
  }
}

function getFilteredSubmissions() {
  if (currentFilter === "all") return cachedSubmissions;
  return cachedSubmissions.filter(item => (item.data.status || "pending") === currentFilter);
}

async function loadSubmissions() {
  const q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  cachedSubmissions = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const taskTitle = await fetchTaskTitle(data.taskId);
    cachedSubmissions.push({
      id: docSnap.id,
      data,
      taskTitle
    });
  }

  renderSubmissions();
}

function renderSubmissions() {
  const filtered = getFilteredSubmissions();

  if (filtered.length === 0) {
    submissionsWrap.innerHTML = '<div class="empty-state">Bu filtrede kayıt yok.</div>';
    return;
  }

  let html = "";
  for (const item of filtered) {
    const s = item.data;
    const statusClass = s.status === "approved" ? "live" : s.status === "rejected" ? "closed" : "review";
    const statusText = s.status === "approved" ? "Onaylandı" : s.status === "rejected" ? "Reddedildi" : "Bekliyor";
    const reasonBlock = s.status === "rejected" && s.rejectedReason
      ? `<div style="margin-top:8px;color:#ffc9d3"><strong>Red Nedeni:</strong> ${safe(s.rejectedReason)}</div>`
      : "";

    html += `
      <div class="list-item submission-card">
        <div class="rank">#</div>
        <div class="submission-content">
          <div class="task-title">${safe(s.userEmail || s.userId)}</div>
          <div class="meta">
            <span>Görev: ${safe(item.taskTitle)}</span>
            <span>Status: ${safe(s.status)}</span>
            <span>X: ${safe(s.xUsername)}</span>
          </div>
          <div class="muted submission-links">
            <strong style="color:#eef4ff">X Profil:</strong> ${s.xProfileLink ? `<a href="${safe(s.xProfileLink)}" target="_blank" rel="noopener noreferrer">${safe(s.xProfileLink)}</a>` : "-"}<br>
            <strong style="color:#eef4ff">Ekran Görüntüsü:</strong> ${s.screenshotLink ? `<a href="${safe(s.screenshotLink)}" target="_blank" rel="noopener noreferrer">${safe(s.screenshotLink)}</a>` : "-"}<br>
            <strong style="color:#eef4ff">Ek Kanıt:</strong> ${s.proof ? `<a href="${safe(s.proof)}" target="_blank" rel="noopener noreferrer">${safe(s.proof)}</a>` : "-"}<br>
            <strong style="color:#eef4ff">Not:</strong> ${safe(s.note) || "-"}
            ${reasonBlock}
          </div>
        </div>
        <div class="reward">
          <span class="status ${statusClass}">${statusText}</span>
          <div class="reward-actions">
            <button class="btn" data-approve="${item.id}" ${(s.status === "approved" || !isAdmin()) ? "disabled" : ""}>Onayla</button>
            <button class="btn-ghost" data-reject="${item.id}" ${(s.status === "rejected" || !isAdmin()) ? "disabled" : ""}>Reddet</button>
          </div>
        </div>
      </div>
    `;
  }

  submissionsWrap.innerHTML = html;

  submissionsWrap.querySelectorAll("[data-approve]").forEach(btn => {
    btn.addEventListener("click", () => approveSubmission(btn.dataset.approve));
  });

  submissionsWrap.querySelectorAll("[data-reject]").forEach(btn => {
    btn.addEventListener("click", () => rejectSubmission(btn.dataset.reject));
  });
}


async function markWithdrawalPaid(withdrawalId) {
  if (!isAdmin()) {
    showAdminNotice("Bu işlem için admin yetkisi gerekli.", "error");
    return;
  }

  const txHash = prompt("Gönderim TX hash değerini gir:");
  if (txHash === null || !txHash.trim()) return;

  const explorerUrl = prompt("İsteğe bağlı explorer linki gir (boş bırakabilirsin):") || "";

  try {
    const wRef = doc(db, "withdrawals", withdrawalId);
    const wSnap = await getDoc(wRef);
    if (!wSnap.exists()) {
      showAdminNotice("Çekim talebi bulunamadı.", "error");
      return;
    }

    const w = wSnap.data();
    if (w.status === "paid") {
      showAdminNotice("Bu çekim zaten ödenmiş.", "error");
      return;
    }

    const userRef = doc(db, "users", w.userId);
    await updateDoc(wRef, {
      status: "paid",
      txHash: txHash.trim(),
      txExplorerUrl: explorerUrl.trim(),
      paidAt: serverTimestamp()
    });

    await updateDoc(userRef, {
      points: increment(-Number(w.pointAmount || 0))
    });

    showAdminNotice("Çekim ödendi olarak işaretlendi ve kullanıcı puanı düşüldü.", "success");
    await loadWithdrawalsAdmin();
  } catch (err) {
    showAdminNotice("Ödeme kaydı güncellenemedi: " + err.message, "error");
  }
}

async function rejectWithdrawal(withdrawalId) {
  if (!isAdmin()) {
    showAdminNotice("Bu işlem için admin yetkisi gerekli.", "error");
    return;
  }

  const reason = prompt("Çekim talebi red nedeni:");
  if (reason === null) return;

  try {
    await updateDoc(doc(db, "withdrawals", withdrawalId), {
      status: "rejected",
      rejectReason: reason.trim(),
      rejectedAt: serverTimestamp()
    });
    showAdminNotice("Çekim talebi reddedildi.", "success");
    await loadWithdrawalsAdmin();
  } catch (err) {
    showAdminNotice("Çekim reddedilemedi: " + err.message, "error");
  }
}

async function loadWithdrawalsAdmin() {
  if (!withdrawAdminList) return;

  const q = query(collection(db, "withdrawals"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    withdrawAdminList.innerHTML = '<div class="empty-state">Henüz çekim talebi yok.</div>';
    return;
  }

  let html = "";
  snap.forEach(docSnap => {
    const w = docSnap.data();
    const statusClass = w.status === "paid" ? "live" : w.status === "rejected" ? "closed" : w.status === "processing" ? "processing" : "review";
    const statusText = w.status === "paid" ? "Ödendi" : w.status === "rejected" ? "Reddedildi" : w.status === "processing" ? "İşleniyor" : "Bekliyor";

    html += `
      <div class="list-item withdraw-card">
        <div class="rank">₿</div>
        <div class="submission-content">
          <div class="task-title">${Number(w.tokenAmount || 0).toFixed(4)} THIVE</div>
          <div class="meta">
            <span>${safe(w.userEmail || "-")}</span>
            <span>${Number(w.pointAmount || 0)} puan</span>
          </div>
          <div class="muted submission-links">
            <strong style="color:#eef4ff">Cüzdan:</strong> ${safe(w.walletAddress)}<br>
            <strong style="color:#eef4ff">Not:</strong> ${safe(w.note) || "-"}<br>
            <strong style="color:#eef4ff">TX Hash:</strong> ${w.txHash ? safe(w.txHash) : "-"}<br>
            ${w.rejectReason ? `<strong style="color:#eef4ff">Red Nedeni:</strong> ${safe(w.rejectReason)}<br>` : ""}
          </div>
        </div>
        <div class="reward">
          <span class="status ${statusClass}">${statusText}</span>
          <div class="admin-actions-grid">
            <button class="btn" data-withdraw-paid="${docSnap.id}" ${(w.status === "paid" || !isAdmin()) ? "disabled" : ""}>Ödendi Olarak İşaretle</button>
            <button class="btn-ghost" data-withdraw-reject="${docSnap.id}" ${(w.status === "rejected" || !isAdmin()) ? "disabled" : ""}>Reddet</button>
          </div>
        </div>
      </div>
    `;
  });

  withdrawAdminList.innerHTML = html;

  withdrawAdminList.querySelectorAll("[data-withdraw-paid]").forEach(btn => {
    btn.addEventListener("click", () => markWithdrawalPaid(btn.dataset.withdrawPaid));
  });
  withdrawAdminList.querySelectorAll("[data-withdraw-reject]").forEach(btn => {
    btn.addEventListener("click", () => rejectWithdrawal(btn.dataset.withdrawReject));
  });
}


form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!isAdmin()) {
    showTaskNotice("Görev eklemek için admin yetkisi gerekli.", "error");
    return;
  }

  const title = document.getElementById("taskName").value.trim();
  const category = document.getElementById("taskCategory").value;
  const reward = Number(document.getElementById("taskReward").value);
  const deadline = document.getElementById("taskDeadline").value;
  const description = document.getElementById("taskDesc").value.trim();

  if (!title || !reward) {
    showTaskNotice("Görev adı ve ödül zorunludur.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "tasks"), {
      title,
      category,
      reward,
      deadline,
      description,
      status: "active",
      createdAt: serverTimestamp()
    });
    form.reset();
    showTaskNotice("Görev başarıyla eklendi.", "success");
    await loadTasks();
  } catch (err) {
    showTaskNotice("Görev eklenemedi: " + err.message, "error");
  }
});

submissionFilters?.querySelectorAll("[data-sub-filter]").forEach(btn => {
  btn.addEventListener("click", () => {
    submissionFilters.querySelectorAll("[data-sub-filter]").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.subFilter;
    renderSubmissions();
  });
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;

  if (!user) {
    currentUserData = null;
    setFormDisabled(true);
    showAdminNotice("Admin paneli için giriş yapmalısın.", "error");
    await loadTasks();
    await loadSubmissions();
    await loadWithdrawalsAdmin();
    await loadWithdrawalsAdmin();
    return;
  }

  const userSnap = await getDoc(doc(db, "users", user.uid));
  currentUserData = userSnap.exists() ? userSnap.data() : null;

  if (!isAdmin()) {
    setFormDisabled(true);
    showAdminNotice('Bu hesap admin değil. Admin olmak için ilgili kullanıcının users kaydında role alanını "admin" yap.', "error");
  } else {
    setFormDisabled(false);
    showAdminNotice("Admin yetkisi doğrulandı.", "success");
  }

  await loadTasks();
  await loadSubmissions();
    await loadWithdrawalsAdmin();
});

loadTasks();
loadSubmissions();
loadWithdrawalsAdmin();
