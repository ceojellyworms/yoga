(() => {
  const config = window.FLOW_STUDIO_CONFIG;
  const supabase = config?.supabasePublishableKey
    ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey)
    : null;

  const tabs = document.querySelector("#day-tabs");
  const scheduleList = document.querySelector("#schedule-list");
  const dialog = document.querySelector("#booking-dialog");
  const form = document.querySelector("#booking-form");
  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector("#main-nav");
  const bookingFields = document.querySelector("#booking-fields");
  const bookingSuccess = document.querySelector("#booking-success");
  const bookingTitle = document.querySelector("#booking-title");
  const phoneInput = document.querySelector("#phone-input");
  let selectedClass = null;
  let activeDay = 1;
  const slug = window.location.pathname.split("/").filter(Boolean)[0] || "flow-studio";
  let studioId = null;

  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.querySelector("#toast-region").append(toast);
    setTimeout(() => toast.remove(), 4500);
  }

  function renderTabs() {
    tabs.innerHTML = dayNames.map((name, index) =>
      `<button class="day-tab ${index + 1 === activeDay ? "active" : ""}" data-day="${index + 1}">${name}</button>`
    ).join("");
  }

  async function loadStudioSettings() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("public_studios")
      .select("id,name,headline,about_text,trial_enabled,show_prices")
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      console.error(error);
      showToast("Не удалось загрузить настройки студии", "error");
      return;
    }
    if (!data) {
      scheduleList.innerHTML = '<div class="schedule-card"><h3>Проект не найден</h3></div>';
      return;
    }
    studioId = data.id;
    document.title = data.name;
    document.querySelector(".brand").innerHTML = escapeHtml(data.name);
    if (data.headline) document.querySelector(".hero h1").textContent = data.headline;
    if (data.about_text) document.querySelector(".atmosphere h2").textContent = data.about_text;
    const trialButton = document.querySelector("#trial-button");
    if (trialButton) trialButton.hidden = !data?.trial_enabled;
    loadSchedule(activeDay);
  }

  async function loadSchedule(day) {
    if (!supabase) {
      scheduleList.innerHTML = '<div class="schedule-card"><div><h3>Подключите Supabase</h3><p>Добавьте publishable key в config.js</p></div></div>';
      return;
    }

    scheduleList.innerHTML = Array.from({ length: 3 }, () => '<div class="schedule-skeleton"></div>').join("");
    const { data, error } = await supabase
      .from("public_classes")
      .select("id,title,time_start,duration_minutes,max_capacity,current_bookings,trainer_id")
      .eq("studio_id", studioId)
      .eq("day_of_week", day)
      .order("time_start");

    if (error) {
      console.error(error);
      scheduleList.innerHTML = "";
      showToast("Не удалось загрузить расписание", "error");
      return;
    }

    if (!data?.length) {
      scheduleList.innerHTML = '<div class="schedule-card"><div><h3>В этот день пока нет занятий</h3><p>Выберите другой день</p></div></div>';
      return;
    }

    const trainerIds = [...new Set(data.map((item) => item.trainer_id).filter(Boolean))];
    let trainersById = {};
    if (trainerIds.length) {
      const { data: trainers, error: trainerError } = await supabase
        .from("public_trainers")
        .select("id,name")
        .in("id", trainerIds);
      if (trainerError) {
        console.error(trainerError);
      } else {
        trainersById = Object.fromEntries((trainers || []).map((trainer) => [trainer.id, trainer]));
      }
    }

    scheduleList.innerHTML = data.map((item) => {
      const spots = Math.max(item.max_capacity - item.current_bookings, 0);
      return `
        <article class="schedule-card">
          <time class="schedule-time">${item.time_start.slice(0, 5)}</time>
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(trainersById[item.trainer_id]?.name || "Тренер уточняется")}</p>
            <p class="spots">${spots ? `Осталось ${spots} ${pluralPlaces(spots)}` : "Мест нет"}</p>
          </div>
          <button class="primary-button liquid-control book-button" data-id="${item.id}" data-title="${escapeHtml(item.title)}" ${spots === 0 ? "disabled" : ""}>Забронировать</button>
        </article>`;
    }).join("");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    })[char]);
  }

  function pluralPlaces(count) {
    if (count % 10 === 1 && count % 100 !== 11) return "место";
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "места";
    return "мест";
  }

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest(".day-tab");
    if (!button) return;
    activeDay = Number(button.dataset.day);
    renderTabs();
    loadSchedule(activeDay);
  });

  scheduleList.addEventListener("click", (event) => {
    const button = event.target.closest(".book-button");
    if (!button) return;
    selectedClass = button.dataset.id;
    bookingTitle.textContent = button.dataset.title;
    bookingFields.hidden = false;
    bookingSuccess.hidden = true;
    form.reset();
    dialog.showModal();
  });

  const trialButton = document.querySelector("#trial-button");
  trialButton?.addEventListener("click", () => {
    document.querySelector("#schedule").scrollIntoView({ behavior: "smooth" });
  });
  menuToggle?.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    menuToggle.setAttribute("aria-label", expanded ? "Открыть меню" : "Закрыть меню");
    mainNav.dataset.open = String(!expanded);
  });
  mainNav?.addEventListener("click", (event) => {
    if (!event.target.closest("a")) return;
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Открыть меню");
    delete mainNav.dataset.open;
  });
  document.querySelectorAll(".scroll-schedule").forEach((button) => {
    button.addEventListener("click", () => document.querySelector("#schedule").scrollIntoView({ behavior: "smooth" }));
  });
  document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());

  phoneInput.addEventListener("input", () => {
    let digits = phoneInput.value.replace(/\D/g, "").slice(0, 11);
    if (digits && digits[0] === 8) digits = `7${digits.slice(1)}`;
    if (digits && digits[0] !== 7) digits = `7${digits}`;
    let value = "+7";
    if (digits.length > 1) value += ` (${digits.slice(1, 4)}`;
    if (digits.length >= 5) value += `) ${digits.slice(4, 7)}`;
    if (digits.length >= 8) value += `-${digits.slice(7, 9)}`;
    if (digits.length >= 10) value += `-${digits.slice(9, 11)}`;
    phoneInput.value = value;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase || !selectedClass) return;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Отправляем...";

    const formData = new FormData(form);
    const payload = {
      class_id: selectedClass,
      client_name: formData.get("client_name").trim(),
      client_phone: formData.get("client_phone").trim(),
    };

    const { error } = await supabase.from("bookings").insert(payload).select("id").single();
    submitButton.disabled = false;
    submitButton.textContent = "Отправить";
    if (error) {
      console.error(error);
      showToast("Не удалось отправить заявку", "error");
      return;
    }

    try {
      await supabase.functions.invoke("send-tg-alert", { body: payload });
    } catch (error) {
      console.error(error);
    }

    bookingFields.hidden = true;
    bookingSuccess.hidden = false;
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
  const directionModels = document.querySelectorAll("#directions model-viewer");
  const modelObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.loading = "eager";
        modelObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: "600px 0px" });
  directionModels.forEach((model) => modelObserver.observe(model));
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll("model-viewer[auto-rotate]").forEach((viewer) => viewer.removeAttribute("auto-rotate"));
  }

  renderTabs();
  loadStudioSettings();
})();
