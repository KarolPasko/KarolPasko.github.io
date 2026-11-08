/* =========================
   ENQUIRY FORM
========================= */

/*
    With a Formspree form ID in site-config.js, enquiries are sent to
    Formspree (and listed in your Formspree dashboard). Without one, they
    are emailed to SITE_CONFIG.contactEmail through FormSubmit
    (formsubmit.co, no account needed; the first enquiry sends an
    "Activate form" email that has to be clicked once). If sending fails,
    the visitor can open their email app with everything filled in.
*/

const enquiryForm = document.getElementById("enquiryForm");
const enquiryStatus = document.getElementById("enquiryStatus");

/* The hire page adds an "equipment" field listing what's on the visitor's list */
function enquirySubject(data) {
    return data.get("equipment")
        ? `Equipment hire enquiry from ${data.get("name")}`
        : `Enquiry from ${data.get("name")}`;
}

function enquiryMailto(data) {
    const subject = enquirySubject(data);
    const lines = [
        `Name: ${data.get("name")}`,
        `Email: ${data.get("email")}`,
        `Date(s): ${data.get("date") || "-"}`,
        `Venue: ${data.get("venue") || "-"}`
    ];
    if (data.get("equipment")) {
        lines.push("", "Equipment:", data.get("equipment"));
    }
    if (data.get("message")) {
        lines.push("", data.get("message"));
    }
    const body = lines.join("\n");

    return `mailto:${SITE_CONFIG.contactEmail}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`;
}

async function sendEnquiry(data) {
    if (SITE_CONFIG.formspreeForm) {
        data.append("_subject", `New ${enquirySubject(data).toLowerCase()}`);
        const response = await fetch(
            `https://formspree.io/f/${SITE_CONFIG.formspreeForm}`,
            { method: "POST", body: data, headers: { Accept: "application/json" } }
        );
        if (!response.ok) throw new Error(`Formspree returned ${response.status}`);
        return;
    }

    const fields = {
        "Name": data.get("name"),
        "Email": data.get("email"),
        "Date(s)": data.get("date") || "-",
        "Venue": data.get("venue") || "-",
        "Message": data.get("message") || "-",
        "Equipment": data.get("equipment") || "-",
        _subject: enquirySubject(data),
        _replyto: data.get("email"),
        _template: "table",
        _captcha: "false"
    };
    const response = await fetch(`https://formsubmit.co/ajax/${SITE_CONFIG.contactEmail}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(fields)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || String(result.success) !== "true") {
        throw new Error(result.message || `FormSubmit returned ${response.status}`);
    }
}

enquiryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(enquiryForm);
    if (data.get("_gotcha")) return;   /* a bot filled the hidden field */

    const button = enquiryForm.querySelector("button");
    button.disabled = true;
    enquiryStatus.className = "form-status";
    enquiryStatus.textContent = "Sending…";

    try {
        await sendEnquiry(data);
        enquiryForm.reset();
        enquiryStatus.classList.add("success");
        enquiryStatus.textContent =
            "Thanks, your enquiry has been sent. I'll get back to you soon.";
    }

    catch (error) {
        console.error("Could not send enquiry:", error);
        enquiryStatus.classList.add("error");
        enquiryStatus.textContent = "Sorry, that didn't send. ";
        const link = document.createElement("a");
        link.href = enquiryMailto(data);
        link.textContent = "Send it from your email app instead";
        enquiryStatus.append(link, ` or email me at ${SITE_CONFIG.contactEmail}.`);
    }

    button.disabled = false;

    /* Lets the hire page clear the visitor's list once it has been sent */
    if (enquiryStatus.classList.contains("success")) {
        enquiryForm.dispatchEvent(new CustomEvent("enquiry-sent"));
    }
});
