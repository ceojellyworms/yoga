(() => {
  const config = window.FLOW_STUDIO_CONFIG;
  const supabase = config?.supabasePublishableKey
    ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey)
    : null;

  const authView = document.querySelector("#auth-view");
  const adminView = document.querySelector("#admin-view");
  const authForm = document.querySelector("#auth-form");
  let studio = null;

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.querySelector("#toast-region").append(toast);
    setTimeout(() => toast.remove(), 4500);
  }

  async function init() {
    if (!supabase) {
      showToast("Добавьте publishable key в config.js", "error");
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (data.session) await enterAdmin();
  }

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(authForm);
    const credentials = {
      email: form.get("email"),
      password: form.get("password"),
    };
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      console.error(error);
      showToast("Не удалось войти", "error");
      return;
    }
    await enterAdmin();
  });

  async function enterAdmin() {
    authView.hidden = true;
    adminView.hidden = false;
    const { data: userData } = await supabase.auth.getUser();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();
    if (profileError) {
      console.error(profileError);
      showToast("Не удалось определить роль", "error");
      return;
    }
    if (profile.role === "superadmin") {
      const adminBrand = document.querySelector("#admin-brand");
      adminBrand.textContent = "Панель проектов";
      document.title = "Панель проектов";
      document.querySelectorAll(".admin-tabs [data-tab]").forEach((tab) => {
        tab.hidden = tab.dataset.tab !== "superadmin-admin";
      });
      document.querySelectorAll(".admin-panel").forEach((panel) => {
        panel.hidden = panel.id !== "superadmin-admin";
      });
      await renderSuperadmin();
      return;
    }
    const { data: assignment } = await supabase
      .from("project_admins")
      .select("studio_id")
      .eq("user_id", userData.user.id)
      .limit(1)
      .maybeSingle();
    if (!assignment) {
      showToast("К этому аккаунту не привязан проект", "error");
      return;
    }
    const { data: studioData, error } = await supabase
      .from("studios")
      .select("*")
      .eq("id", assignment.studio_id)
      .single();
    if (error) {
      console.error(error);
      showToast("Не удалось загрузить проект", "error");
      return;
    }
    studio = studioData;
    const adminBrand = document.querySelector("#admin-brand");
    adminBrand.textContent = studio.name;
    document.title = `${studio.name} — Панель`;
    await renderSchedule();
  }

  document.querySelector("#logout-button").addEventListener("click", async () => {
    await supabase.auth.signOut();
    adminView.hidden = true;
    authView.hidden = false;
  });

  document.querySelector(".admin-tabs").addEventListener("click", async (event) => {
    const tab = event.target.closest("[data-tab]");
    if (!tab) return;
    document.querySelectorAll("[data-tab]").forEach((item) => item.classList.toggle("active", item === tab));
    document.querySelectorAll(".admin-panel").forEach((panel) => panel.hidden = panel.id !== tab.dataset.tab);
    if (tab.dataset.tab === "schedule-admin") await renderSchedule();
    if (tab.dataset.tab === "trainers-admin") await renderTrainers();
    if (tab.dataset.tab === "settings-admin") await renderSettings();
    if (tab.dataset.tab === "bookings-admin") await renderBookings();
    if (tab.dataset.tab === "superadmin-admin") await renderSuperadmin();
  });

  async function renderSuperadmin() {
    const panel = document.querySelector("#superadmin-admin");
    panel.hidden = false;
    panel.innerHTML = `
      <h2>Проекты</h2>
      <form id="project-form" class="admin-form">
        <label>Название проекта<input name="name" required placeholder="Название студии" /></label>
        <label>Адрес проекта<input name="slug" required placeholder="например: moon-yoga" /></label>
        <label>Email администратора клуба<input name="admin_email" type="email" required /></label>
        <label>Пароль администратора клуба<input name="admin_password" type="password" minlength="8" required /></label>
        <button class="primary-button" type="submit">Создать проект</button>
      </form>
      <div id="projects-list">Загрузка...</div>`;

    document.querySelector("#project-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const { data, error } = await supabase.functions.invoke("create-project", {
        body: {
          name: form.get("name"),
          slug: form.get("slug"),
          admin_email: form.get("admin_email"),
          admin_password: form.get("admin_password"),
          site_url: `${location.origin}/`,
        },
      });
      if (error) {
        console.error(error);
        showToast("Не удалось создать проект", "error");
        return;
      }
      const resultPanel = document.querySelector("#projects-list");
      const credentialsPanel = document.createElement("div");
      credentialsPanel.className = "admin-form";
      credentialsPanel.innerHTML = `
        <h3>Проект создан</h3>
        <p>Адрес: <strong>${escapeHtml(data.url)}</strong></p>
        <p>Email: <strong>${escapeHtml(data.credentials.email)}</strong></p>
        <p>Пароль: <strong>${escapeHtml(data.credentials.password)}</strong></p>`;
      resultPanel.before(credentialsPanel);
      showToast("Проект создан");
      event.currentTarget.reset();
    });

    const { data, error } = await supabase
      .from("studios")
      .select("id,name,slug,admin_email,admin_initial_password,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      showToast("Не удалось загрузить проекты", "error");
      return;
    }
    document.querySelector("#projects-list").innerHTML = data?.length
      ? data.map((project) => `
        <article class="schedule-card">
          <div>
            <h3>${escapeHtml(project.name)}</h3>
            <p><a href="/${escapeHtml(project.slug)}" target="_blank">/${escapeHtml(project.slug)}</a></p>
            <p>${escapeHtml(project.admin_email || "")}</p>
          </div>
          <div>
            <button class="glass-button edit-project" data-id="${project.id}" data-name="${escapeHtml(project.name)}" data-slug="${escapeHtml(project.slug)}">Изменить</button>
            <button class="glass-button reset-project-password" data-id="${project.id}">Пароль</button>
            <div><strong>${escapeHtml(project.admin_initial_password || "Пароль изменён")}</strong></div>
          </div>
        </article>`).join("")
      : "<p>Проектов пока нет</p>";

    document.querySelector("#projects-list").addEventListener("click", async (event) => {
      const editButton = event.target.closest(".edit-project");
      if (editButton) {
        const name = prompt("Название проекта", editButton.dataset.name);
        if (!name) return;
        const slug = prompt("Адрес проекта", editButton.dataset.slug);
        if (!slug) return;
        const { error } = await supabase.functions.invoke("manage-project", {
          body: { action: "update", studio_id: editButton.dataset.id, name, slug },
        });
        if (error) {
          console.error(error);
          showToast("Не удалось изменить проект", "error");
        } else {
          await renderSuperadmin();
        }
        return;
      }
      const resetButton = event.target.closest(".reset-project-password");
      if (resetButton) {
        const password = prompt("Новый пароль администратора проекта (минимум 8 символов)");
        if (!password) return;
        const { error } = await supabase.functions.invoke("manage-project", {
          body: { action: "reset_password", studio_id: resetButton.dataset.id, password },
        });
        if (error) {
          console.error(error);
          showToast("Не удалось сменить пароль", "error");
        } else {
          await renderSuperadmin();
          showToast("Пароль проекта изменён");
        }
      }
    });
  }

  async function renderSchedule() {
    const panel = document.querySelector("#schedule-admin");
    panel.innerHTML = '<h2>Расписание</h2><button id="add-class" class="primary-button">Добавить занятие</button><div id="classes-admin-list">Загрузка...</div>';

    const { data, error } = await supabase
      .from("classes")
      .select("*,trainer:trainers(name)")
      .eq("studio_id", studio.id)
      .order("day_of_week")
      .order("time_start");
    if (error) {
      console.error(error);
      showToast("Не удалось загрузить занятия", "error");
      return;
    }
    document.querySelector("#classes-admin-list").innerHTML = data?.length
      ? data.map((item) => `
        <article class="schedule-card">
          <time class="schedule-time">${item.time_start.slice(0,5)}</time>
          <div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.trainer?.name || "")}</p></div>
          <button class="glass-button delete-class" data-id="${item.id}">Удалить</button>
        </article>`).join("")
      : "<p>Занятий пока нет</p>";

    document.querySelector("#classes-admin-list").addEventListener("click", async (event) => {
      const button = event.target.closest(".delete-class");
      if (!button) return;
      const { error: deleteError } = await supabase.from("classes").delete().eq("id", button.dataset.id);
      if (deleteError) {
        console.error(deleteError);
        showToast("Не удалось удалить занятие", "error");
      } else {
        await renderSchedule();
      }
    });

    document.querySelector("#add-class").addEventListener("click", async () => {
      const title = prompt("Название занятия");
      if (!title) return;
      const day = Number(prompt("День недели (1=Пн, 7=Вс)", "1"));
      const time = prompt("Время (HH:MM)", "09:00");
      const { error: insertError } = await supabase.from("classes").insert({
        studio_id: studio.id,
        title,
        day_of_week: day,
        time_start: time,
        duration_minutes: 60,
        max_capacity: 10,
        current_bookings: 0,
      });
      if (insertError) {
        console.error(insertError);
        showToast("Не удалось добавить занятие", "error");
      } else {
        await renderSchedule();
      }
    });
  }

  async function renderTrainers() {
    const panel = document.querySelector("#trainers-admin");
    panel.innerHTML = `
      <h2>Тренеры</h2>
      <form id="trainer-form" class="admin-form">
        <label>Имя<input name="name" required /></label>
        <label>Описание<textarea name="bio"></textarea></label>
        <label>Фото<input name="photo" type="file" accept="image/*" /></label>
        <button class="primary-button" type="submit">Сохранить</button>
      </form>
      <div id="trainers-list"></div>`;

    const { data, error } = await supabase.from("trainers").select("*").eq("studio_id", studio.id);
    if (error) {
      console.error(error);
      showToast("Не удалось загрузить тренеров", "error");
      return;
    }
    document.querySelector("#trainers-list").innerHTML = data?.map((trainer) => `
      <article class="schedule-card">
        ${trainer.photo_url ? `<img src="${escapeHtml(trainer.photo_url)}" alt="" style="width:80px;height:80px;border-radius:16px;object-fit:cover">` : ""}
        <div><h3>${escapeHtml(trainer.name)}</h3><p>${escapeHtml(trainer.bio || "")}</p></div>
      </article>`).join("") || "<p>Тренеров пока нет</p>";

    document.querySelector("#trainer-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      let photoUrl = null;
      const photo = form.get("photo");
      if (photo?.size) {
        const path = `${studio.user_id}/${crypto.randomUUID()}-${photo.name}`;
        const { error: uploadError } = await supabase.storage.from("trainer-photos").upload(path, photo);
        if (uploadError) {
          console.error(uploadError);
          showToast("Не удалось загрузить фото", "error");
          return;
        }
        photoUrl = supabase.storage.from("trainer-photos").getPublicUrl(path).data.publicUrl;
      }
      const { error: insertError } = await supabase.from("trainers").insert({
        studio_id: studio.id,
        name: form.get("name"),
        bio: form.get("bio"),
        photo_url: photoUrl,
      });
      if (insertError) {
        console.error(insertError);
        showToast("Не удалось сохранить тренера", "error");
      } else {
        await renderTrainers();
      }
    });
  }

  async function renderSettings() {
    const panel = document.querySelector("#settings-admin");
    panel.innerHTML = `
      <h2>Настройки</h2>
      <form id="settings-form" class="admin-form">
        <label>Название студии<input name="name" value="${escapeHtml(studio.name || "")}"></label>
        <label>Главный слоган<input name="headline" value="${escapeHtml(studio.headline || "")}"></label>
        <label>Текст о студии<textarea name="about_text">${escapeHtml(studio.about_text || "")}</textarea></label>
        <label><input name="trial_enabled" type="checkbox" ${studio.trial_enabled ? "checked" : ""}> Показывать пробное занятие</label>
        <label><input name="show_prices" type="checkbox" ${studio.show_prices ? "checked" : ""}> Показывать цены</label>
        <label>Telegram Bot Token<input name="tg_bot_token" type="password" value="${escapeHtml(studio.tg_bot_token || "")}"></label>
        <label>Telegram Chat ID<input name="tg_chat_id" value="${escapeHtml(studio.tg_chat_id || "")}"></label>
        <p>${studio.tg_started_at ? "Telegram подключён" : "Telegram не подтверждён"}</p>
        <button id="check-tg-start" type="button" class="glass-button">Я нажал /start в боте</button>
        <label>Новый пароль администратора<input name="new_password" type="password" minlength="8" autocomplete="new-password"></label>
        <button class="primary-button" type="submit">Сохранить</button>
      </form>`;

    document.querySelector("#check-tg-start").addEventListener("click", async () => {
      const { data, error } = await supabase.functions.invoke("check-tg-start", {
        body: { studio_id: studio.id },
      });
      if (error) {
        console.error(error);
        showToast("Не удалось проверить Telegram", "error");
        return;
      }
      if (data?.verified) {
        studio.tg_started_at = new Date().toISOString();
        await renderSettings();
        showToast("Telegram подключён");
      } else {
        showToast("Бот не получил /start от указанного Chat ID", "error");
      }
    });

    document.querySelector("#settings-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const updates = {
        name: form.get("name"),
        headline: form.get("headline") || null,
        about_text: form.get("about_text") || null,
        trial_enabled: form.has("trial_enabled"),
        show_prices: form.has("show_prices"),
        tg_bot_token: form.get("tg_bot_token") || null,
        tg_chat_id: form.get("tg_chat_id") || null,
      };
      const newPassword = form.get("new_password");
      if (newPassword) {
        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
        if (passwordError) {
          console.error(passwordError);
          showToast("Не удалось изменить пароль", "error");
          return;
        }
        await supabase
          .from("studios")
          .update({ admin_initial_password: newPassword })
          .eq("id", studio.id);
      }
      const { error } = await supabase.from("studios").update(updates).eq("id", studio.id);
      if (error) {
        console.error(error);
        showToast("Не удалось сохранить настройки", "error");
      } else {
        studio = { ...studio, ...updates };
        showToast("Настройки сохранены");
      }
    });
  }

  async function renderBookings() {
    const panel = document.querySelector("#bookings-admin");
    panel.innerHTML = "<h2>Заявки</h2><div id=\"bookings-list\">Загрузка...</div>";
    const { data: classes } = await supabase
      .from("classes")
      .select("id")
      .eq("studio_id", studio.id);
    const classIds = (classes || []).map((item) => item.id);
    if (!classIds.length) {
      document.querySelector("#bookings-list").innerHTML = "<p>Заявок пока нет</p>";
      return;
    }
    const { data, error } = await supabase
      .from("bookings")
      .select("id,client_name,client_phone,status,created_at,class:classes(title,time_start)")
      .in("class_id", classIds)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      showToast("Не удалось загрузить заявки", "error");
      return;
    }
    document.querySelector("#bookings-list").innerHTML = data?.length
      ? data.map((booking) => `
        <article class="schedule-card">
          <div>
            <h3>${escapeHtml(booking.client_name)}</h3>
            <p>${escapeHtml(booking.client_phone)}</p>
            <p>${escapeHtml(booking.class?.title || "")}</p>
          </div>
          <select class="booking-status" data-id="${booking.id}">
            ${["pending","confirmed","cancelled","done"].map((status) =>
              `<option value="${status}" ${booking.status === status ? "selected" : ""}>${status}</option>`
            ).join("")}
          </select>
        </article>`).join("")
      : "<p>Заявок пока нет</p>";
    document.querySelector("#bookings-list").addEventListener("change", async (event) => {
      const select = event.target.closest(".booking-status");
      if (!select) return;
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ status: select.value })
        .eq("id", select.dataset.id);
      if (updateError) {
        console.error(updateError);
        showToast("Не удалось изменить статус", "error");
      } else {
        showToast("Статус изменён");
      }
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    })[char]);
  }

  init();
})();
