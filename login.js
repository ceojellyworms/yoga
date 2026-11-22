(() => {
  const config = window.FLOW_STUDIO_CONFIG;
  const supabase = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
  const form = document.querySelector("#login-form");
  const errorText = document.querySelector("#login-error");

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) window.location.replace("/admin");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorText.hidden = true;
    const submit = form.querySelector("button");
    submit.disabled = true;
    submit.textContent = "Входим...";
    const formData = new FormData(form);
    let error = null;
    const login = String(formData.get("login") || "").trim();
    if (login.includes("@")) {
      const result = await supabase.auth.signInWithPassword({
        email: login,
        password: formData.get("password"),
      });
      error = result.error;
    } else {
      const { data, error: functionError } = await supabase.functions.invoke("login-project-admin", {
        body: { login, password: formData.get("password") },
      });
      if (functionError) {
        console.error(functionError);
        error = functionError;
      } else if (data?.access_token && data?.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        error = sessionError;
      } else {
        error = new Error(data?.error || "Неверный логин или пароль");
      }
    }
    submit.disabled = false;
    submit.textContent = "Войти";
    if (error) {
      console.error(error);
      errorText.textContent = "Неверный email или пароль";
      errorText.hidden = false;
      return;
    }
    window.location.replace("/admin");
  });
})();
