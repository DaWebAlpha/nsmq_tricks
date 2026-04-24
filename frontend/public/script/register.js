const USERNAME_REGEX = /^(?=.{3,20}$)[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GHANA_PHONE_REGEX = /^(?:\+233|233|0)(2[3-7]|5[0-9])[0-9]{7}$/;

document.addEventListener("DOMContentLoaded", () => {
    console.log("register.js loaded");

    const form = document.getElementById("registerForm");
    const usernameInput = document.getElementById("username");
    const emailInput = document.getElementById("email");
    const phoneNumberInput = document.getElementById("phoneNumber");
    const passwordInput = document.getElementById("password");
    const passwordToggle = document.getElementById("passwordToggle");
    const submitButton = form?.querySelector(".login__button");

    if (!form) return;

    const getFormGroup = (input) => input?.closest(".form__group");
    const getErrorElement = (inputId) => document.getElementById(`${inputId}Error`);

    const showError = (input, message) => {
        const formGroup = getFormGroup(input);
        const errorElement = getErrorElement(input.id);

        if (formGroup) {
            formGroup.classList.add("error");
            formGroup.classList.remove("success");
        }

        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add("show");
        }
    };

    const showSuccess = (input) => {
        const formGroup = getFormGroup(input);
        const errorElement = getErrorElement(input.id);

        if (formGroup) {
            formGroup.classList.remove("error");
            formGroup.classList.add("success");
        }

        if (errorElement) {
            errorElement.textContent = "";
            errorElement.classList.remove("show");
        }
    };

    const clearState = (input) => {
        const formGroup = getFormGroup(input);
        const errorElement = getErrorElement(input.id);

        if (formGroup) {
            formGroup.classList.remove("error");
            formGroup.classList.remove("success");
        }

        if (errorElement) {
            errorElement.textContent = "";
            errorElement.classList.remove("show");
        }
    };

    const validateUsername = (value) => {
        const cleanedValue = String(value || "").trim();

        if (!cleanedValue) {
            return { isValid: false, message: "Username is required" };
        }

        if (cleanedValue.length < 3) {
            return { isValid: false, message: "Username is too short" };
        }

        if (cleanedValue.length > 20) {
            return { isValid: false, message: "Username is too long" };
        }

        if (!USERNAME_REGEX.test(cleanedValue)) {
            return {
                isValid: false,
                message: "Username can contain letters, numbers, ., - and _",
            };
        }

        return { isValid: true, message: "" };
    };

    const validateEmail = (value) => {
        const cleanedValue = String(value || "").trim().toLowerCase();

        if (!cleanedValue) {
            return { isValid: false, message: "Email is required" };
        }

        if (cleanedValue.length < 5) {
            return { isValid: false, message: "Email is too short" };
        }

        if (cleanedValue.length > 120) {
            return { isValid: false, message: "Email is too long" };
        }

        if (!EMAIL_REGEX.test(cleanedValue)) {
            return { isValid: false, message: "Invalid email format" };
        }

        return { isValid: true, message: "" };
    };

    const validatePhoneNumber = (value) => {
        const cleanedValue = String(value || "").trim();

        if (!cleanedValue) {
            return { isValid: false, message: "Phone number is required" };
        }

        if (!GHANA_PHONE_REGEX.test(cleanedValue)) {
            return { isValid: false, message: "Enter a valid Ghana phone number" };
        }

        return { isValid: true, message: "" };
    };

    const getPasswordChecks = (value) => {
        const cleanedValue = String(value || "");

        return {
            minLength: cleanedValue.length >= 8,
            lowercase: /[a-z]/.test(cleanedValue),
            uppercase: /[A-Z]/.test(cleanedValue),
            number: /\d/.test(cleanedValue),
            special: /[\W_]/.test(cleanedValue),
        };
    };

    const renderPasswordChecks = (value) => {
        const formGroup = getFormGroup(passwordInput);
        const errorElement = getErrorElement("password");
        if (!errorElement || !formGroup) return;

        const hasValue = String(value || "").length > 0;

        if (!hasValue) {
            formGroup.classList.remove("error", "success");
            errorElement.textContent = "";
            errorElement.classList.remove("show");
            return false;
        }

        const checks = getPasswordChecks(value);
        const allValid =
            checks.minLength &&
            checks.lowercase &&
            checks.uppercase &&
            checks.number &&
            checks.special;

        formGroup.classList.toggle("error", !allValid);
        formGroup.classList.toggle("success", allValid);

        errorElement.innerHTML = `
            <div class="password__rules">
                <div class="${checks.minLength ? "rule--ok" : "rule--bad"}">At least 8 characters</div>
                <div class="${checks.lowercase ? "rule--ok" : "rule--bad"}">At least one lowercase letter</div>
                <div class="${checks.uppercase ? "rule--ok" : "rule--bad"}">At least one uppercase letter</div>
                <div class="${checks.number ? "rule--ok" : "rule--bad"}">At least one number</div>
                <div class="${checks.special ? "rule--ok" : "rule--bad"}">At least one special character</div>
            </div>
        `;
        errorElement.classList.add("show");

        return allValid;
    };

    const validateField = (input) => {
        if (!input) return true;

        let result = { isValid: true, message: "" };

        if (input.id === "username") {
            result = validateUsername(input.value);
        } else if (input.id === "email") {
            result = validateEmail(input.value);
        } else if (input.id === "phoneNumber") {
            result = validatePhoneNumber(input.value);
        } else if (input.id === "password") {
            return renderPasswordChecks(input.value);
        }

        if (!result.isValid) {
            showError(input, result.message);
            return false;
        }

        showSuccess(input);
        return true;
    };

    const validateForm = () => {
        const usernameValid = validateField(usernameInput);
        const emailValid = validateField(emailInput);
        const phoneValid = validateField(phoneNumberInput);
        const passwordValid = validateField(passwordInput);

        return usernameValid && emailValid && phoneValid && passwordValid;
    };

    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener("click", () => {
            const toggleIcon = passwordToggle.querySelector(".toggle__icon");
            const isHidden = passwordInput.type === "password";

            passwordInput.type = isHidden ? "text" : "password";

            if (toggleIcon) {
                toggleIcon.classList.toggle("show-password", isHidden);
            }

            passwordInput.focus();
        });
    }

    usernameInput?.addEventListener("input", () => {
        console.log("username typing:", usernameInput.value);
        validateField(usernameInput);
    });

    emailInput?.addEventListener("input", () => {
        validateField(emailInput);
    });

    phoneNumberInput?.addEventListener("input", () => {
        validateField(phoneNumberInput);
    });

    passwordInput?.addEventListener("input", () => {
        validateField(passwordInput);
    });

    [usernameInput, emailInput, phoneNumberInput, passwordInput].forEach((input) => {
        if (!input) return;

        input.addEventListener("blur", () => {
            validateField(input);
        });
    });

    form.addEventListener("submit", (event) => {
        const isValid = validateForm();

        if (!isValid) {
            event.preventDefault();
            return;
        }

        if (submitButton) {
            submitButton.classList.add("loading");
            submitButton.disabled = true;
        }
    });
});

