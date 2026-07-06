// ============================================================
// app.js — 마트어택맵 동작 로직
// ------------------------------------------------------------
// 흐름 요약:
//   1) 사용자가 도시를 입력/클릭한다
//   2) data.js의 CITY_DATA에서 해당 도시를 찾는다
//   3) Top 10 리스트를 화면에 그린다
//   4) 체크하면 localStorage(브라우저 저장소)에 저장한다
//      → 새로고침해도 체크 상태가 유지된다!
// ============================================================

// --- 자주 쓰는 HTML 요소를 미리 찾아둡니다 ---
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const cityChips = document.getElementById("city-chips");
const resultEl = document.getElementById("result");
const profileEl = document.getElementById("profile");
const attackBtn = searchForm.querySelector("button[type=submit]");

// 공유 기능에서 링크로 사용할 배포 주소
const APP_URL = "https://lgw7126.github.io/Claude-Mart-Attack-Map-app/";

// 현재 보고 있는 도시 (아직 없으면 null)
let currentCity = null;

// ============================================================
// [재미 효과] 어택 버튼을 누르면 이모지가 팡! 하고 터지는 효과
//   - 실제 데이터에는 영향 없는 순수 시각 효과입니다
// ============================================================

function burstConfetti(originEl) {
  const rect = originEl.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  const emojis = ["🎉", "✨", "🛒", "🎊", "⭐", "🧃"];

  for (let i = 0; i < 16; i++) {
    const particle = document.createElement("span");
    particle.className = "confetti-particle";
    particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];

    // 사방으로 랜덤하게 튀어나가는 방향과 거리 계산
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 90;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance - 30; // 살짝 위쪽으로 치우치게

    particle.style.left = originX + "px";
    particle.style.top = originY + "px";
    particle.style.setProperty("--tx", tx + "px");
    particle.style.setProperty("--ty", ty + "px");
    particle.style.setProperty("--rot", Math.random() * 360 - 180 + "deg");

    document.body.appendChild(particle);
    particle.addEventListener("animationend", function () {
      particle.remove();
    });
  }
}

// ============================================================
// [공유] 텍스트를 공유하거나(모바일) 클립보드에 복사(PC)
// ============================================================

function shareText(text) {
  if (navigator.share) {
    navigator.share({ text: text }).catch(function () {
      // 사용자가 공유를 취소한 경우 등 - 별도 처리 없이 무시
    });
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(function () {
        alert("공유 내용을 클립보드에 복사했어요! 원하는 곳에 붙여넣기 해보세요 📋");
      })
      .catch(function () {
        alert(text);
      });
  } else {
    alert(text);
  }
}

// ============================================================
// [저장소] localStorage 다루기
//   - 키 예시: "mart-attack:tokyo" → 값: [0, 3, 7] (체크한 항목 번호)
// ============================================================

function storageKey(cityId) {
  return "mart-attack:" + cityId;
}

// 체크된 항목 번호 배열을 불러오기 (없으면 빈 배열)
function loadChecked(cityId) {
  const saved = localStorage.getItem(storageKey(cityId));
  return saved ? JSON.parse(saved) : [];
}

// 체크된 항목 번호 배열을 저장하기
function saveChecked(cityId, checkedIndexes) {
  localStorage.setItem(storageKey(cityId), JSON.stringify(checkedIndexes));
}

// ============================================================
// [내가 추가한 아이템] 유저가 직접 입력한 아이템 저장/불러오기
//   - 키 예시: "mart-attack:custom:tokyo"
//   - 값: [{ name: "이름", checked: true/false }, ...]
//   - 기본 제공 Top 10과는 별도로 관리됩니다 (10/10 정복 판정에는 영향 없음)
// ============================================================

function customStorageKey(cityId) {
  return "mart-attack:custom:" + cityId;
}

function loadCustomItems(cityId) {
  const saved = localStorage.getItem(customStorageKey(cityId));
  return saved ? JSON.parse(saved) : [];
}

function saveCustomItems(cityId, items) {
  localStorage.setItem(customStorageKey(cityId), JSON.stringify(items));
}

// ============================================================
// [내 정보] 프로필 저장/불러오기
//   - 키: "mart-attack:profile" → 값: { name: "닉네임" }
//   - 체크 기록과 마찬가지로 이 브라우저에만 저장됩니다
// ============================================================

function loadProfile() {
  const saved = localStorage.getItem("mart-attack:profile");
  return saved ? JSON.parse(saved) : null;
}

function saveProfile(profile) {
  localStorage.setItem("mart-attack:profile", JSON.stringify(profile));
}

// 모든 도시의 체크 기록을 합산해서 "나의 어택 통계"를 계산
function getMyStats() {
  let totalChecked = 0;   // 지금까지 겟한 아이템 수
  let conquered = 0;      // 10개를 모두 겟한(정복한) 도시 수

  CITY_DATA.forEach(function (city) {
    const checked = loadChecked(city.id);
    totalChecked += checked.length;
    if (checked.length === city.items.length) conquered += 1;

    // 내가 직접 추가해서 체크한 아이템도 합산
    totalChecked += loadCustomItems(city.id).filter(function (item) {
      return item.checked;
    }).length;
  });

  return { totalChecked: totalChecked, conquered: conquered };
}

// 프로필 영역 그리기: 닉네임이 없으면 입력폼, 있으면 인사말+통계
function renderProfile() {
  const profile = loadProfile();

  if (!profile || !profile.name) {
    // 아직 닉네임이 없을 때: 입력폼 표시
    profileEl.innerHTML = `
      <div class="profile-card">
        <span class="profile-emoji">👤</span>
        <input type="text" id="nickname-input" placeholder="닉네임을 저장해보세요!" maxlength="12" />
        <button type="button" id="nickname-save">저장</button>
      </div>
    `;
    document.getElementById("nickname-save").addEventListener("click", submitNickname);
    document.getElementById("nickname-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") submitNickname();
    });
  } else {
    // 닉네임이 있을 때: 인사말 + 나의 어택 통계 + 내 기록 버튼
    const stats = getMyStats();
    profileEl.innerHTML = `
      <div class="profile-card">
        <span class="profile-emoji">🧑‍✈️</span>
        <div class="profile-info" id="profile-open" title="내 기록 보기">
          <strong>${escapeHtml(profile.name)}</strong>님의 마트어택
          <span class="profile-stats">🎯 총 ${stats.totalChecked}개 겟 · 🏆 정복한 도시 ${stats.conquered}곳</span>
        </div>
        <button type="button" id="mypage-btn">📋 내 기록</button>
        <button type="button" id="nickname-edit" title="닉네임 수정">✏️</button>
      </div>
    `;
    // "내 기록" 버튼 또는 이름 부분을 누르면 내 기록 페이지로
    document.getElementById("mypage-btn").addEventListener("click", renderMyPage);
    document.getElementById("profile-open").addEventListener("click", renderMyPage);
    document.getElementById("nickname-edit").addEventListener("click", function () {
      saveProfile({ name: "" }); // 이름을 비우면 입력폼으로 돌아감
      renderProfile();
    });
  }
}

// ============================================================
// [내 기록 페이지] 체크한 도시들과 체크리스트를 한 화면에 모아보기
// ============================================================

function renderMyPage() {
  const profile = loadProfile();
  const name = profile && profile.name ? profile.name : "여행자";
  const stats = getMyStats();

  // 도시 화면이 아니므로 칩 강조 해제
  currentCity = null;
  cityChips.querySelectorAll(".chip").forEach(function (chip) {
    chip.classList.remove("active");
  });

  // 체크한 아이템(기본 Top10 또는 내가 추가한 아이템)이 1개 이상 있는 도시만 골라내기
  const visitedCities = CITY_DATA.filter(function (city) {
    const hasCustomChecked = loadCustomItems(city.id).some(function (item) {
      return item.checked;
    });
    return loadChecked(city.id).length > 0 || hasCustomChecked;
  });

  let html = `
    <div class="city-header">
      <h2>📋 ${escapeHtml(name)}님의 어택 기록</h2>
      <p class="marts">🎯 총 ${stats.totalChecked}개 겟 · 🏆 정복한 도시 ${stats.conquered}곳 / ${CITY_DATA.length}곳</p>
      ${visitedCities.length > 0 ? '<button type="button" class="share-btn-outline" id="share-mypage-btn">📤 내 기록 공유하기</button>' : ""}
    </div>
  `;

  if (visitedCities.length === 0) {
    // 아직 아무것도 체크 안 했을 때
    html += `
      <div class="notice" style="margin-top: 16px">
        <p>아직 체크한 아이템이 없어요. 🛒</p>
        <p>도시를 골라 <strong>첫 아이템을 겟</strong>해보세요!</p>
      </div>
    `;
  } else {
    // 도시별 카드: 진행 상황 + 겟한 아이템 목록
    visitedCities.forEach(function (city) {
      const checked = loadChecked(city.id);
      const isDone = checked.length === city.items.length;

      let itemsHtml = "";
      city.items.forEach(function (item, index) {
        if (checked.includes(index)) {
          itemsHtml += `<li>✅ ${item.emoji} ${item.name}</li>`;
        }
      });
      // 내가 직접 추가해서 체크한 아이템도 함께 표시
      loadCustomItems(city.id).forEach(function (item) {
        if (item.checked) {
          itemsHtml += `<li>✅ 🛍️ ${escapeHtml(item.name)} <span class="custom-tag">직접 추가</span></li>`;
        }
      });

      html += `
        <div class="mypage-city" data-city="${city.id}">
          <div class="mypage-city-head">
            <strong>${city.country} ${city.name}</strong>
            <span class="${isDone ? "badge-done" : "badge-ing"}">
              ${isDone ? "🏆 정복 완료!" : "✅ " + checked.length + " / " + city.items.length}
            </span>
          </div>
          <ul class="mypage-items">${itemsHtml}</ul>
          <p class="mypage-open">누르면 ${city.name} 체크리스트로 이동 →</p>
        </div>
      `;
    });
  }

  resultEl.innerHTML = html;

  // 내 기록 공유 버튼 이벤트
  const shareMyPageBtn = document.getElementById("share-mypage-btn");
  if (shareMyPageBtn) {
    shareMyPageBtn.addEventListener("click", function () {
      const cityList = visitedCities
        .map(function (city) {
          const checked = loadChecked(city.id);
          const isDone = checked.length === city.items.length;
          return city.name + (isDone ? "(🏆 정복)" : "(" + checked.length + "/" + city.items.length + ")");
        })
        .join(", ");
      shareText(
        `${name}님의 마트어택 기록 🛒\n🎯 총 ${stats.totalChecked}개 겟 · 🏆 정복한 도시 ${stats.conquered}곳\n📍 ${cityList}\n\n👉 ${APP_URL}`
      );
    });
  }

  // 도시 카드를 누르면 그 도시의 체크리스트로 이동
  resultEl.querySelectorAll(".mypage-city").forEach(function (box) {
    box.addEventListener("click", function () {
      const city = CITY_DATA.find(function (c) {
        return c.id === box.dataset.city;
      });
      cityInput.value = city.name;
      selectCity(city);
    });
  });
}

// 닉네임 입력폼에서 저장 버튼을 눌렀을 때
function submitNickname() {
  const input = document.getElementById("nickname-input");
  const name = input.value.trim();
  if (!name) {
    input.focus();
    return;
  }
  saveProfile({ name: name });
  renderProfile();
}

// ============================================================
// [검색] 입력한 텍스트로 도시 찾기
//   - 대소문자 구분 없이, aliases(별칭)까지 비교합니다
// ============================================================

function findCity(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  return CITY_DATA.find(function (city) {
    return city.aliases.some(function (alias) {
      return alias.toLowerCase() === q;
    });
  });
}

// ============================================================
// [화면 그리기] 도시 리스트 렌더링
// ============================================================

function renderCity(city) {
  currentCity = city;
  const checked = loadChecked(city.id);
  const total = city.items.length;
  const doneCount = checked.length;
  const percent = Math.round((doneCount / total) * 100);

  // --- 도시 헤더 + 진행률 바 ---
  let html = `
    <div class="city-header">
      <h2>${city.country} ${city.name} 필수템 Top 10</h2>
      <p class="marts">📍 추천 마트: ${city.marts}</p>
      <div class="progress-wrap">
        <div class="progress-label">
          <span>어택 진행률</span>
          <span>${doneCount} / ${total} 겟!</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percent}%"></div>
        </div>
      </div>
    </div>
  `;

  // --- 아이템 카드 10개 ---
  html += '<ul class="item-list">';
  city.items.forEach(function (item, index) {
    const isDone = checked.includes(index);
    html += `
      <li class="item-card ${isDone ? "done" : ""}" data-index="${index}">
        <input type="checkbox" ${isDone ? "checked" : ""} aria-label="${item.name} 구매 완료" />
        <div class="item-body">
          <div class="item-title">${index + 1}. ${item.emoji} ${item.name}</div>
          <p class="item-desc">${item.desc}</p>
          <p class="item-meta">🏪 ${item.where} · 💰 ${item.price}</p>
        </div>
      </li>
    `;
  });
  html += "</ul>";

  // --- 10개 모두 체크하면 축하 배너 (+ 공유 버튼) ---
  if (doneCount === total) {
    html += `
      <div class="complete-banner">
        🎉 어택 완료! 이 마트는 정복했습니다!
        <button type="button" class="share-btn" id="share-city-btn">📤 정복 소식 공유하기</button>
      </div>
    `;
  }

  // --- 내가 추가한 아이템 섹션 ---
  const customItems = loadCustomItems(city.id);
  html += '<div class="custom-section">';
  html += '<p class="custom-heading">🙋 내가 추가한 아이템</p>';
  if (customItems.length > 0) {
    html += '<ul class="item-list">';
    customItems.forEach(function (item, index) {
      html += `
        <li class="item-card custom-item ${item.checked ? "done" : ""}" data-custom-index="${index}">
          <input type="checkbox" ${item.checked ? "checked" : ""} aria-label="${escapeHtml(item.name)} 구매 완료" />
          <div class="item-body">
            <div class="item-title">🛍️ ${escapeHtml(item.name)}</div>
          </div>
          <button type="button" class="custom-delete" data-custom-index="${index}" title="삭제">✕</button>
        </li>
      `;
    });
    html += "</ul>";
  }
  html += `
    <form class="custom-add-form" id="custom-add-form">
      <input type="text" id="custom-item-input" placeholder="내가 산 다른 아이템 추가하기" maxlength="30" autocomplete="off" />
      <button type="submit">+ 추가</button>
    </form>
  `;
  html += "</div>";

  // --- 체크 초기화 버튼 ---
  html += '<button class="reset-btn" id="reset-btn">↺ 체크 전체 초기화</button>';

  resultEl.innerHTML = html;

  // --- 방금 그린 카드들에 클릭 이벤트 연결 (기본 Top10 + 내가 추가한 아이템 공통) ---
  resultEl.querySelectorAll(".item-card").forEach(function (card) {
    card.addEventListener("click", function (event) {
      // 삭제(✕) 버튼을 눌렀을 때는 체크 토글이 함께 실행되지 않도록 제외
      if (event.target.classList.contains("custom-delete")) return;

      // 카드 아무 곳이나 눌러도 체크되도록 처리
      const checkbox = card.querySelector("input[type=checkbox]");
      if (event.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
      }

      if (card.dataset.customIndex !== undefined) {
        toggleCustomItem(Number(card.dataset.customIndex), checkbox.checked);
      } else {
        toggleItem(Number(card.dataset.index), checkbox.checked);
      }
    });
  });

  // --- 커스텀 아이템 삭제(✕) 버튼 이벤트 ---
  resultEl.querySelectorAll(".custom-delete").forEach(function (btn) {
    btn.addEventListener("click", function (event) {
      event.stopPropagation(); // 카드 클릭(체크 토글)으로 번지지 않게 막기
      deleteCustomItem(Number(btn.dataset.customIndex));
    });
  });

  // --- 아이템 추가 폼 제출 이벤트 ---
  document.getElementById("custom-add-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const input = document.getElementById("custom-item-input");
    const name = input.value.trim();
    if (!name) return;

    const items = loadCustomItems(city.id);
    items.push({ name: name, checked: false });
    saveCustomItems(city.id, items);
    renderCity(city);
    renderProfile();
  });

  // --- 초기화 버튼 이벤트 ---
  document.getElementById("reset-btn").addEventListener("click", function () {
    if (confirm(city.name + "의 체크를 모두 지울까요?")) {
      saveChecked(city.id, []);
      renderCity(city);    // 다시 그려서 화면 갱신
      renderProfile();     // 통계도 갱신
    }
  });

  // --- 정복 공유 버튼 이벤트 ---
  const shareCityBtn = document.getElementById("share-city-btn");
  if (shareCityBtn) {
    shareCityBtn.addEventListener("click", function () {
      const profile = loadProfile();
      const who = profile && profile.name ? profile.name : "여행자";
      const gotList = city.items
        .map(function (item) {
          return item.emoji + item.name;
        })
        .join(", ");
      shareText(
        `${who}님이 마트어택맵에서 ${city.country} ${city.name}을 정복했어요! 🏆\n\n🛒 겟한 아이템: ${gotList}\n\n👉 ${APP_URL}`
      );
    });
  }
}

// 커스텀 아이템 체크/해제
function toggleCustomItem(index, isChecked) {
  const items = loadCustomItems(currentCity.id);
  items[index].checked = isChecked;
  saveCustomItems(currentCity.id, items);
  renderCity(currentCity);
  renderProfile();
}

// 커스텀 아이템 삭제
function deleteCustomItem(index) {
  const items = loadCustomItems(currentCity.id);
  items.splice(index, 1);
  saveCustomItems(currentCity.id, items);
  renderCity(currentCity);
  renderProfile();
}

// 항목 하나를 체크/해제하고 저장한 뒤 화면을 다시 그림
function toggleItem(index, isChecked) {
  let checked = loadChecked(currentCity.id);

  if (isChecked && !checked.includes(index)) {
    checked.push(index);
  } else if (!isChecked) {
    checked = checked.filter(function (i) {
      return i !== index;
    });
  }

  saveChecked(currentCity.id, checked);
  renderCity(currentCity);
  renderProfile(); // 체크할 때마다 "나의 어택 통계"도 갱신
}

// ============================================================
// [화면 그리기] 도시를 못 찾았을 때 안내
// ============================================================

function renderNotFound(query) {
  const cityNames = CITY_DATA.map(function (c) {
    return c.name;
  }).join(", ");

  resultEl.innerHTML = `
    <div class="notice">
      <p>😢 <strong>"${escapeHtml(query)}"</strong>는 아직 준비 중인 도시예요.</p>
      <p>지금은 <strong>${cityNames}</strong>를 지원합니다.<br />위의 도시 버튼을 눌러보세요!</p>
    </div>
  `;
}

// 사용자 입력을 화면에 그대로 넣으면 위험하므로(XSS 방지) 특수문자 처리
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
// [초기 설정] 도시 칩 버튼 만들기 + 검색 이벤트 연결
// ============================================================

// 지원 도시들을 "지역별로 묶어서" 칩 버튼으로 표시
// 1) 도시들을 region 값 기준으로 그룹화한 뒤
// 2) 지역 이름 + 그 지역의 도시 칩들을 순서대로 그린다
const regions = [];
CITY_DATA.forEach(function (city) {
  if (!regions.includes(city.region)) regions.push(city.region);
});

regions.forEach(function (region) {
  // 지역 이름 라벨
  const label = document.createElement("div");
  label.className = "region-label";
  label.textContent = region;
  cityChips.appendChild(label);

  // 그 지역에 속한 도시 칩들
  const row = document.createElement("div");
  row.className = "chip-row";
  CITY_DATA.filter(function (city) {
    return city.region === region;
  }).forEach(function (city) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = city.name;
    chip.addEventListener("click", function () {
      cityInput.value = city.name;
      selectCity(city);
      burstConfetti(chip); // 어택 재미 효과: 누른 칩에서 팡!
    });
    row.appendChild(chip);
  });
  cityChips.appendChild(row);
});

// 칩 활성화 표시 + 렌더링을 한 번에
function selectCity(city) {
  renderCity(city);
  // 현재 도시 칩만 주황색으로 강조
  cityChips.querySelectorAll(".chip").forEach(function (chip) {
    chip.classList.toggle("active", chip.textContent === city.name);
  });
}

// 검색 폼 제출(엔터 또는 버튼 클릭) 처리
searchForm.addEventListener("submit", function (event) {
  event.preventDefault(); // 페이지 새로고침 막기 (기본 동작 취소)

  const query = cityInput.value;
  const city = findCity(query);

  if (city) {
    selectCity(city);
    burstConfetti(attackBtn); // 어택 재미 효과: 버튼에서 팡!
  } else {
    renderNotFound(query);
    // 못 찾았으면 칩 강조도 해제
    cityChips.querySelectorAll(".chip").forEach(function (chip) {
      chip.classList.remove("active");
    });
  }
});

// 첫 화면: 프로필 영역 그리기
renderProfile();

// 첫 화면 안내 메시지
resultEl.innerHTML = `
  <div class="notice">
    <p>✈️ 어느 도시의 마트를 털러 가시나요?</p>
    <p>위에 도시를 입력하거나 버튼을 눌러<br /><strong>현지인 추천 필수템 Top 10</strong>을 확인하세요!</p>
  </div>
`;

// ============================================================
// [오프라인 지원] 서비스워커 등록
//   - 한 번 접속하면 마트에서 와이파이가 끊겨도 앱이 계속 열립니다
//   - file:// 로 직접 열었을 때는 등록되지 않는 게 정상입니다 (보안 정책)
// ============================================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function () {
      // 오프라인 지원은 선택 기능이므로, 실패해도 앱은 그대로 정상 동작합니다
    });
  });
}
