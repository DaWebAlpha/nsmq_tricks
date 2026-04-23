/**
 * ============================================================================
 * LOGIN PAGE SCRIPT
 * ============================================================================
 * Purpose:
 *   - Password visibility toggle
 *   - Client-side validation
 *   - Loading state on submit
 *   - Small interaction polish
 * ============================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const identifierInput = document.getElementById("identifier");
    const passwordInput = document.getElementById("password");
    const passwordToggle = document.getElementById("passwordToggle");
    const submitButton = form?.querySelector(".login__button");

    if (!form) return;

    /**
     * ------------------------------------------------------------------------
     * HELPERS
     * ------------------------------------------------------------------------
     */
    const getFormGroup = (input) => input?.closest(".form__group");

    const getErrorElement = (inputId) =>
        document.getElementById(`${inputId}Error`);

    const showError = (input, message) => {
        const formGroup = getFormGroup(input);
        const errorElement = getErrorElement(input.id);

        if (formGroup) {
            formGroup.classList.add("error");
        }

        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add("show");
        }
    };

    const clearError = (input) => {
        const formGroup = getFormGroup(input);
        const errorElement = getErrorElement(input.id);

        if (formGroup) {
            formGroup.classList.remove("error");
        }

        if (errorElement) {
            errorElement.textContent = "";
            errorElement.classList.remove("show");
        }
    };

    const validateIdentifier = (value) => {
        const cleanedValue = String(value || "").trim();

        if (!cleanedValue) {
            return {
                isValid: false,
                message: "Identifier is required.",
            };
        }

        if (cleanedValue.length < 3) {
            return {
                isValid: false,
                message: "Identifier must be at least 3 characters.",
            };
        }

        return {
            isValid: true,
            message: "",
        };
    };

    const validatePassword = (value) => {
        const cleanedValue = String(value || "");

        if (!cleanedValue.trim()) {
            return {
                isValid: false,
                message: "Password is required.",
            };
        }

        if (cleanedValue.length < 6) {
            return {
                isValid: false,
                message: "Password must be at least 6 characters.",
            };
        }

        return {
            isValid: true,
            message: "",
        };
    };

    const validateField = (input) => {
        if (!input) return true;

        let result = { isValid: true, message: "" };

        if (input.id === "identifier") {
            result = validateIdentifier(input.value);
        }

        if (input.id === "password") {
            result = validatePassword(input.value);
        }

        if (!result.isValid) {
            showError(input, result.message);
            return false;
        }

        clearError(input);
        return true;
    };

    const validateForm = () => {
        const isIdentifierValid = validateField(identifierInput);
        const isPasswordValid = validateField(passwordInput);

        return isIdentifierValid && isPasswordValid;
    };

    const setLoadingState = (isLoading) => {
        if (!submitButton) return;

        submitButton.classList.toggle("loading", isLoading);
        submitButton.disabled = isLoading;
    };

    /**
     * ------------------------------------------------------------------------
     * PASSWORD TOGGLE
     * ------------------------------------------------------------------------
     */
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

    /**
     * ------------------------------------------------------------------------
     * REAL-TIME VALIDATION
     * ------------------------------------------------------------------------
     */
    [identifierInput, passwordInput].forEach((input) => {
        if (!input) return;

        input.addEventListener("blur", () => {
            validateField(input);
        });

        input.addEventListener("input", () => {
            clearError(input);
        });
    });

    /**
     * ------------------------------------------------------------------------
     * FORM SUBMIT
     * ------------------------------------------------------------------------
     * Important:
     * - This does not block real backend login.
     * - It only prevents submit when client-side fields are obviously invalid.
     */
    form.addEventListener("submit", (event) => {
        const isValid = validateForm();

        if (!isValid) {
            event.preventDefault();
            return;
        }

        setLoadingState(true);
    });

    /**
     * ------------------------------------------------------------------------
     * ACCESSIBILITY / UX
     * ------------------------------------------------------------------------
     */
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            [identifierInput, passwordInput].forEach((input) => {
                if (input) clearError(input);
            });
        }
    });

    /**
     * ------------------------------------------------------------------------
     * OPTIONAL LINK FEEDBACK
     * ------------------------------------------------------------------------
     */
    const forgotPasswordLink = document.querySelector(".forgot__password");
    const signupLink = document.querySelector(".signup__link a");

    [forgotPasswordLink, signupLink].forEach((link) => {
        if (!link) return;

        link.addEventListener("click", () => {
            link.style.transform = "scale(0.98)";
            setTimeout(() => {
                link.style.transform = "";
            }, 120);
        });
    });
});