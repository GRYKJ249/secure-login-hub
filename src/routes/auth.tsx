import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { OperaLogoMark } from "@/components/brand/OperaLogoMark";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/lib/i18n";
import { COUNTRIES, DEFAULT_COUNTRY, type Country } from "@/lib/countries";
import { requestPhoneCode, verifyPhoneCode } from "@/lib/auth-otp.functions";
import { suggestUsername, checkUsername } from "@/lib/username.functions";
import { isPlaceholderUsername } from "@/hooks/useProfile";
import { uploadAvatar } from "@/lib/avatar";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Opera AI" },
      {
        name: "description",
        content: "Create your Opera AI account with your phone number and a WhatsApp code.",
      },
      { property: "og:title", content: "Sign in — Opera AI" },
      {
        property: "og:description",
        content: "Create your Opera AI account with your phone number and a WhatsApp code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Step = "phone" | "code" | "profile";
type PhoneMode = "code" | "password";

function syntheticEmail(phone: string) {
  return `${phone.replace(/\D/g, "")}@phone.opera.local`;
}

function CountryPicker({
  value,
  onChange,
}: {
  value: Country;
  onChange: (country: Country) => void;
}) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return COUNTRIES;
    return COUNTRIES.filter(
      (country) =>
        country.en.toLowerCase().includes(needle) ||
        country.ar.includes(needle) ||
        country.dial.includes(needle) ||
        country.code.toLowerCase() === needle,
    );
  }, [query]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="glass flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
      >
        <span className="text-base">{value.flag}</span>
        <span className="flex-1 truncate text-start">{lang === "ar" ? value.ar : value.en}</span>
        <span dir="ltr" className="text-muted-foreground">
          {value.dial}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="glass-strong absolute z-50 mt-2 max-h-72 w-full overflow-hidden rounded-xl">
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Search country", "ابحث عن دولة")}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {results.map((country) => (
              <li key={country.code}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(country);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-foreground/5"
                >
                  <span className="text-base">{country.flag}</span>
                  <span className="flex-1 truncate text-start">
                    {lang === "ar" ? country.ar : country.en}
                  </span>
                  <span dir="ltr" className="text-muted-foreground">
                    {country.dial}
                  </span>
                  {country.code === value.code && <Check className="h-4 w-4 text-primary" />}
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-3 py-3 text-center text-sm text-muted-foreground">
                {t("No country found", "ما في دولة بهذا الاسم")}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function AuthPage() {
  const { t, lang } = useLang();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const sendCodeFn = useServerFn(requestPhoneCode);
  const verifyCodeFn = useServerFn(verifyPhoneCode);
  const suggestUsernameFn = useServerFn(suggestUsername);
  const checkUsernameFn = useServerFn(checkUsername);

  const [step, setStep] = useState<Step>("phone");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [localNumber, setLocalNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phoneMode, setPhoneMode] = useState<PhoneMode>("code");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [usernameState, setUsernameState] = useState<"idle" | "checking" | "free" | "taken" | "invalid">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Already signed in: finish the profile if it is incomplete, otherwise go to chat.
  useEffect(() => {
    if (loading || !user) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!isPlaceholderUsername(data?.username)) {
        navigate({ to: "/chat", replace: true });
        return;
      }
      const existingName = data?.display_name ?? "";
      setDisplayName(/^\d+$/.test(existingName) ? "" : existingName);
      setStep("profile");
    })();
  }, [loading, user, navigate]);

  const fullPhone = `${country.dial}${localNumber.replace(/\D/g, "")}`;

  const sendCode = async () => {
    if (localNumber.replace(/\D/g, "").length < 6) {
      toast.error(t("Enter your phone number.", "اكتب رقم هاتفك."));
      return;
    }
    setBusy(true);
    try {
      const result = await sendCodeFn({
        data: { phone: fullPhone, countryCode: country.code },
      });
      if (!result.ok) {
        const messages: Record<string, string> = {
          country_unavailable: t("Sign-up is not available for this country.", "التسجيل غير متاح لهذه الدولة."),
          too_many_requests: t("Too many codes requested. Try again later.", "طلبت أكواد كثيرة. جرب بعد شوية."),
          send_failed: t("We couldn't send the code on WhatsApp.", "ما قدرنا نرسل الكود على واتساب."),
          server_error: t("Something went wrong. Try again.", "حصل خطأ. جرب تاني."),
        };
        const detail =
          "detail" in result && result.detail
            ? String(result.detail)
            : "reason" in result && result.reason
              ? String(result.reason)
              : "message" in result && result.message
                ? String(result.message)
                : null;
        const state = "instanceState" in result && result.instanceState ? String(result.instanceState) : null;
        const extra = [state ? `WhatsApp: ${state}` : null, detail].filter(Boolean).join(" — ");
        toast.error(
          [messages[result.error] ?? messages["server_error"]!, extra].filter(Boolean).join("\n"),
        );
        return;
      }
      setPhone(fullPhone);
      setPreviewCode("code" in result ? (result.code ?? null) : null);
      setCode("");
      setStep("code");
      toast.success(t("Code sent on WhatsApp.", "تم إرسال الكود على واتساب."));
    } catch (error) {
      console.error(error);
      toast.error(
        `${t("Something went wrong. Try again.", "حصل خطأ. جرب تاني.")}\n${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setBusy(false);
    }
  };


  const verify = async (value: string) => {
    setBusy(true);
    try {
      const result = await verifyCodeFn({ data: { phone, code: value } });
      if (!result.ok) {
        const messages: Record<string, string> = {
          expired: t("That code expired. Ask for a new one.", "الكود انتهى. اطلب كود جديد."),
          wrong_code: t("Wrong code. Check and try again.", "الكود غلط. راجعه وجرب تاني."),
          too_many_attempts: t("Too many tries. Ask for a new code.", "محاولات كثيرة. اطلب كود جديد."),
          server_error: t("Something went wrong. Try again.", "حصل خطأ. جرب تاني."),
        };
        toast.error(messages[result.error] ?? messages["server_error"]!);
        setCode("");
        return;
      }
      const { error } =
        result.mode === "otp"
          ? await supabase.auth.verifyOtp({ type: "magiclink", token_hash: result.tokenHash })
          : await supabase.auth.signInWithPassword({ email: result.email, password: result.password });
      if (error) {
        toast.error(error.message);
        return;
      }
      setPreviewCode(null);
      setStep("profile");
    } catch (error) {
      console.error(error);
      toast.error(t("Something went wrong. Try again.", "حصل خطأ. جرب تاني."));
    } finally {
      setBusy(false);
    }
  };

  // Returning users can sign in directly with the password they set earlier.
  const signInWithPhonePassword = async () => {
    if (localNumber.replace(/\D/g, "").length < 6) {
      toast.error(t("Enter your phone number.", "اكتب رقم هاتفك."));
      return;
    }
    if (loginPassword.length < 6) {
      toast.error(t("Password must be at least 6 characters.", "كلمة المرور لا تقل عن 6 حروف أو أرقام."));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: syntheticEmail(fullPhone),
        password: loginPassword,
      });
      if (error) {
        toast.error(
          t(
            "Wrong phone number or password. You can sign in with a WhatsApp code instead.",
            "رقم الهاتف أو كلمة المرور غير صحيحة. تقدر تدخل برمز واتساب بدلاً من ذلك.",
          ),
        );
        return;
      }
      setPhone(fullPhone);
      navigate({ to: "/chat", replace: true });
    } catch (error) {
      console.error(error);
      toast.error(t("Something went wrong. Try again.", "حصل خطأ. جرب تاني."));
    } finally {
      setBusy(false);
    }
  };

  const pickAvatar = async (file: File) => {
    setBusy(true);
    const result = await uploadAvatar(file);
    setBusy(false);
    if (!result.ok) {
      toast.error(
        result.error === "too_large"
          ? t("Pick an image under 5 MB.", "اختر صورة أقل من 5 ميجا.")
          : result.error === "not_image"
            ? t("Pick an image file.", "اختر ملف صورة.")
            : (result.message ?? t("Upload failed.", "فشل رفع الصورة.")),
      );
      return;
    }
    setAvatarPath(result.path);
    setAvatarPreview(result.url);
  };

  // Suggest a free username built from the name the user typed.
  const makeSuggestion = async (name: string, manual = false) => {
    const source = name.trim();
    if (!source) return;
    try {
      const result = await suggestUsernameFn({ data: { name: source } });
      setUsername(result.username);
      setUsernameState("free");
      if (manual) setUsernameTouched(false);
    } catch (error) {
      console.error(error);
    }
  };

  // Auto-fill the username from the name until the user edits it themselves.
  useEffect(() => {
    if (step !== "profile" || usernameTouched) return;
    const name = displayName.trim();
    if (!name) return;
    const timer = setTimeout(() => void makeSuggestion(name), 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, step, usernameTouched]);

  // Live availability check for a username the user typed.
  useEffect(() => {
    if (!usernameTouched) return;
    const handle = username.trim().replace(/^@/, "").toLowerCase();
    if (!handle) {
      setUsernameState("idle");
      return;
    }
    setUsernameState("checking");
    const timer = setTimeout(() => {
      void checkUsernameFn({ data: { username: handle } })
        .then((result) => setUsernameState(result.available ? "free" : result.ok ? "taken" : "invalid"))
        .catch(() => setUsernameState("idle"));
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, usernameTouched]);

  const saveProfile = async () => {
    const handle = username.trim().replace(/^@/, "").toLowerCase();
    if (!displayName.trim() || !handle) {
      toast.error(t("Add your name and a username.", "أضف اسمك واسم المستخدم."));
      return;
    }
    if (!/^[a-z0-9_.]{3,24}$/.test(handle)) {
      toast.error(
        t(
          "Usernames use 3-24 letters, numbers, dots or underscores.",
          "اسم المستخدم من 3 إلى 24 حرف أو رقم أو نقطة أو شرطة سفلية.",
        ),
      );
      return;
    }
    if (password.length < 6) {
      toast.error(t("Password must be at least 6 characters.", "كلمة المرور لا تقل عن 6 حروف أو أرقام."));
      return;
    }
    const { data: current } = await supabase.auth.getUser();
    if (!current.user) return;

    setBusy(true);
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      setBusy(false);
      toast.error(passwordError.message);
      return;
    }
    const { error } = await supabase.from("profiles").upsert({
      id: current.user.id,
      display_name: displayName.trim(),
      username: handle,
      phone: phone || (current.user.user_metadata?.["phone"] as string | undefined) || null,
      country_code: country.code,
      ...(avatarPath ? { avatar_url: avatarPath } : {}),
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? t("That username is taken.", "اسم المستخدم محجوز.")
          : error.message,
      );
      return;
    }
    navigate({ to: "/chat", replace: true });
  };

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="flex min-h-screen items-center justify-center px-4 py-10"
    >
      <div className="glass-strong w-full max-w-md rounded-3xl p-8">
        <Link to="/" className="flex items-center justify-center gap-2.5">
          <OperaLogoMark className="h-9 w-9" />
          <span className="font-display text-lg font-bold">
            Opera<span className="text-primary">AI</span>
          </span>
        </Link>

        {step === "phone" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (phoneMode === "password") void signInWithPhonePassword();
              else void sendCode();
            }}
            className="mt-7 space-y-4"
          >
            <h1 className="text-center font-display text-xl font-bold">
              {t("Sign in with your phone", "سجّل دخولك برقم هاتفك")}
            </h1>
            <p className="text-center text-sm text-muted-foreground">
              {phoneMode === "code"
                ? t("We'll send a code on WhatsApp.", "راح نرسل ليك كود على واتساب.")
                : t("Sign in with your password.", "سجّل دخولك بكلمة المرور.")}
            </p>

            <div className="glass grid grid-cols-2 gap-1 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setPhoneMode("code")}
                className={`rounded-lg py-2 transition ${phoneMode === "code" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
              >
                {t("WhatsApp code", "رمز واتساب")}
              </button>
              <button
                type="button"
                onClick={() => setPhoneMode("password")}
                className={`rounded-lg py-2 transition ${phoneMode === "password" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
              >
                {t("Phone + password", "رقم وكلمة مرور")}
              </button>
            </div>

            <CountryPicker value={country} onChange={setCountry} />

            <label className="glass flex items-center gap-2 rounded-xl px-3 py-2.5">
              <Phone className="h-4 w-4 text-primary" />
              <span dir="ltr" className="text-sm text-muted-foreground">
                {country.dial}
              </span>
              <input
                value={localNumber}
                onChange={(event) => setLocalNumber(event.target.value)}
                dir="ltr"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="901234567"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </label>

            {phoneMode === "password" && (
              <label className="glass flex items-center gap-2 rounded-xl px-3 py-2.5">
                <Lock className="h-4 w-4 text-primary" />
                <input
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  type={showLoginPassword ? "text" : "password"}
                  dir="ltr"
                  autoComplete="current-password"
                  placeholder={t("Password", "كلمة المرور")}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((value) => !value)}
                  aria-label={t("Show password", "إظهار كلمة المرور")}
                  className="text-muted-foreground transition hover:text-primary"
                >
                  {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </label>
            )}

            <button type="submit" disabled={busy} className="btn-hero w-full justify-center !py-2.5 text-sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {phoneMode === "password" ? t("Sign in", "تسجيل الدخول") : t("Send code", "أرسل الكود")}
            </button>
          </form>
        )}

        {step === "code" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verify(code);
            }}
            className="mt-7 space-y-4"
          >
            <h1 className="text-center font-display text-xl font-bold">{t("Enter the code", "أدخل الكود")}</h1>
            <p className="text-center text-sm text-muted-foreground" dir="ltr">
              {phone}
            </p>

            <div className="flex justify-center" dir="ltr">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(next) => {
                  setCode(next);
                  if (next.length === 6 && !busy) void verify(next);
                }}
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="glass h-12 w-11 rounded-xl border-border/60 text-lg font-semibold first:rounded-xl last:rounded-xl"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            {previewCode && (
              <p className="rounded-xl bg-primary/10 px-3 py-2 text-center text-xs text-muted-foreground">
                {t("WhatsApp sending is not connected yet — your code is", "إرسال واتساب غير موصول بعد — كودك هو")}{" "}
                <span dir="ltr" className="font-semibold text-foreground">
                  {previewCode}
                </span>
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-hero w-full justify-center !py-2.5 text-sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {t("Verify", "تأكيد")}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setPreviewCode(null);
                setCode("");
              }}
              className="btn-ghost w-full justify-center !py-2 text-xs"
            >
              {t("Change number", "تغيير الرقم")}
            </button>
          </form>
        )}

        {step === "profile" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveProfile();
            }}
            className="mt-7 space-y-4"
          >
            <h1 className="text-center font-display text-xl font-bold">{t("Your profile", "ملفك الشخصي")}</h1>
            <p className="text-center text-sm text-muted-foreground">
              {t("Add a picture, your name and a username.", "أضف صورة واسمك واسم المستخدم.")}
            </p>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative h-24 w-24 overflow-hidden rounded-full border border-border/60 bg-foreground/5"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  </span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void pickAvatar(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-ghost !py-1.5 text-xs"
              >
                {t("Choose from gallery", "اختر من المعرض")}
              </button>
            </div>

            <label className="glass flex items-center gap-2 rounded-xl px-3 py-2.5">
              <UserRound className="h-4 w-4 text-primary" />
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={60}
                placeholder={t("Display name", "الاسم الظاهر")}
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <label className="glass flex items-center gap-2 rounded-xl px-3 py-2.5">
              <span className="text-sm text-muted-foreground">@</span>
              <input
                value={username}
                onChange={(event) => {
                  setUsernameTouched(true);
                  setUsername(event.target.value.replace(/\s+/g, "").toLowerCase());
                }}
                dir="ltr"
                maxLength={24}
                placeholder="username"
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                title={t("Suggest another", "اقترح غيره")}
                onClick={() => void makeSuggestion(displayName, true)}
                className="text-muted-foreground transition hover:text-primary"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </label>
            <p className="-mt-2 px-1 text-xs text-muted-foreground">
              {usernameState === "checking"
                ? t("Checking…", "جاري التحقق…")
                : usernameState === "taken"
                  ? t("That username is taken.", "اسم المستخدم محجوز.")
                  : usernameState === "invalid"
                    ? t("Use 3-24 letters, numbers, dots or underscores.", "من 3 إلى 24 حرف أو رقم أو نقطة أو شرطة سفلية.")
                    : usernameState === "free"
                      ? t("This username is available.", "اسم المستخدم متاح.")
                      : t("We suggest one from your name — you can change it.", "بنقترح ليك واحد من اسمك — وتقدر تغيّره.")}
            </p>

            <label className="glass flex items-center gap-2 rounded-xl px-3 py-2.5">
              <Lock className="h-4 w-4 text-primary" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                dir="ltr"
                minLength={6}
                autoComplete="new-password"
                placeholder={t("Password (6+ characters)", "كلمة المرور (6 حروف أو أرقام فأكثر)")}
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={t("Show password", "إظهار كلمة المرور")}
                className="text-muted-foreground transition hover:text-primary"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </label>
            <p className="-mt-2 px-1 text-xs text-muted-foreground">
              {t(
                "You can use this password with your phone number to sign in later.",
                "تقدر تستخدم كلمة المرور دي مع رقم هاتفك للدخول لاحقاً.",
              )}
            </p>

            <button type="submit" disabled={busy} className="btn-hero w-full justify-center !py-2.5 text-sm">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {t("Save and continue", "احفظ وواصل")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
