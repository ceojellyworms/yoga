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
    const { error } = await supabase.auth.signInWithPassword({
      email: formData.get("email"),
      password: formData.get("password"),
    });
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
