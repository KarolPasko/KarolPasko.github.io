/* =========================
   ENQUIRY FORM
========================= */

/*
    With a Formspree form ID in site-config.js, enquiries are sent to
    Formspree (and listed in your Formspree dashboard). Without one, the
    form opens the visitor's email app with everything filled in.
*/

const enquiryForm = document.getElementById("enquiryForm");
const enquiryStatus = document.getElementById("enquiryStatus");

/* The hire page adds an "equipment" field listing what's on the visitor's list */
function enquirySubject(data) {
    return data.get("equipment")
        ? `Equipment hire enquiry from ${data.get("name")}`
        : `Enquiry from ${data.get("name")}`;
}

function enquiryAsEmail(data) {
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

    window.location.href =
        `mailto:${SITE_CONFIG.contactEmail}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`;
}

enquiryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(enquiryForm);

    if (!SITE_CONFIG.formspreeForm) {
        enquiryAsEmail(data);
        return;
    }

    const button = enquiryForm.querySelector("button");
    button.disabled = true;
    enquiryStatus.className = "form-status";
    enquiryStatus.textContent = "Sending…";

    data.append("_subject", data.get("equipment")
        ? `New equipment hire enquiry from ${data.get("name")}`
        : `New enquiry from ${data.get("name")}`);

    try {
        const response = await fetch(
            `https://formspree.io/f/${SITE_CONFIG.formspreeForm}`,
            { method: "POST", body: data, headers: { Accept: "application/json" } }
        );

        if (!response.ok) {
            throw new Error(`Formspree returned ${response.status}`);
        }

        enquiryForm.reset();
        enquiryStatus.classList.add("success");
        enquiryStatus.textContent =
            "Thanks, your enquiry has been sent. I'll get back to you soon.";
    }

    catch (error) {
        console.error("Could not send enquiry:", error);
        enquiryStatus.classList.add("error");
        enquiryStatus.textContent =
            `Sorry, that didn't send. Please email me at ${SITE_CONFIG.contactEmail}.`;
    }

    button.disabled = false;

    /* Lets the hire page clear the visitor's list once it has been sent */
    if (enquiryStatus.classList.contains("success")) {
        enquiryForm.dispatchEvent(new CustomEvent("enquiry-sent"));
    }
});
