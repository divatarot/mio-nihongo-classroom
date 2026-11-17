// Public Apps Script web app URL. The script stores replies and sends the receipt.
const TRIAL_ENDPOINT = "";

const trialForm = document.querySelector("#trial-form");
const sourceOptions = trialForm.querySelectorAll('input[name="source"]');
const otherSourceField = document.querySelector("#other-source-field");
const otherSourceInput = trialForm.elements.otherSource;
const errorBox = document.querySelector("#trial-error");

function updateOtherSource() {
  const show = trialForm.elements.source.value === "其他";
  otherSourceField.hidden = !show;
  otherSourceInput.required = show;
  if (!show) otherSourceInput.value = "";
}

sourceOptions.forEach((option) => option.addEventListener("change", updateOtherSource));

trialForm.addEventListener("submit", (event) => {
  errorBox.hidden = true;
  const email = trialForm.elements.email.value.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(email)) {
    event.preventDefault();
    errorBox.textContent = "請填寫有效的 @gmail.com 信箱。";
    errorBox.hidden = false;
    trialForm.elements.email.focus();
    return;
  }
  trialForm.elements.email.value = email;
  if (!TRIAL_ENDPOINT) {
    event.preventDefault();
    errorBox.textContent = "試上申請服務正在設定，請稍後再試。";
    errorBox.hidden = false;
    return;
  }
  trialForm.action = TRIAL_ENDPOINT;
});
