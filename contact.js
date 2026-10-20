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

function enquiryAsEmail(data) {
    const subject = `Enquiry from ${data.get("name")}`;
    const body = [
        `Name: ${data.get("name")}`,
        `Email: ${data.get("email")}`,
        `Date(s): ${data.get("date") || "-"}`,
        `Venue: ${data.get("venue") || "-"}`,
        "",
        data.get("message")
    ].join("\n");

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

    data.append("_subject", `New enquiry from ${data.get("name")}`);

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
});
