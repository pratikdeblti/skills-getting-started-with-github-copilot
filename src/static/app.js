document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const signupButton = document.getElementById("signup-button");
  const confirmModal = document.getElementById("confirm-modal");
  const confirmModalMessage = document.getElementById("confirm-modal-message");
  const confirmYes = document.getElementById("confirm-yes");
  const confirmNo = document.getElementById("confirm-no");

  // Helper to show a confirmation modal. Returns a Promise that resolves to true/false.
  function showConfirm(text) {
    return new Promise((resolve) => {
      if (!confirmModal || !confirmYes || !confirmNo || !confirmModalMessage) {
        // Fallback to window.confirm if modal elements aren't available
        resolve(window.confirm(text));
        return;
      }

      function cleanup() {
        confirmModal.classList.add("hidden");
        confirmYes.removeEventListener("click", onYes);
        confirmNo.removeEventListener("click", onNo);
      }

      function onYes() {
        cleanup();
        resolve(true);
      }

      function onNo() {
        cleanup();
        resolve(false);
      }

      confirmModalMessage.textContent = text;
      confirmModal.classList.remove("hidden");
      confirmYes.addEventListener("click", onYes);
      confirmNo.addEventListener("click", onNo);
    });
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Reset activity select to avoid duplicate options on re-fetch
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
  const activityCard = document.createElement("div");
  activityCard.className = "activity-card";
  // store the activity name on the card for easy lookup
  activityCard.dataset.activity = name;

        const spotsLeft = details.max_participants - details.participants.length;

        // Build participants HTML (list with a delete icon for each participant)
        const participantsHTML =
          details.participants && details.participants.length
            ? `<div class="participants"><strong>Participants:</strong><ul class="participants-list">${details.participants
                .map(
                  (p) =>
                    `<li><span class="participant-email">${p}</span><button class="participant-delete" data-activity="${encodeURIComponent(
                      name
                    )}" data-email="${encodeURIComponent(p)}" title="Unregister">✖</button></li>`
                )
                .join("")}</ul></div>`
            : `<div class="participants"><strong>Participants:</strong><p class="participants-empty">No participants yet</p></div>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          ${participantsHTML}
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    // show spinner and disable button
    try {
      if (signupButton) {
        const spinner = signupButton.querySelector(".spinner");
        signupButton.disabled = true;
        if (spinner) spinner.classList.remove("hidden");
      }
    } catch (e) {
      console.error("Failed to show spinner:", e);
    }

    // Optimistic UI: append the participant immediately so the user sees it right away.
    // We'll remove this optimistic item if the request fails.
    let optimisticLi = null;
    try {
      const card = Array.from(document.querySelectorAll(".activity-card")).find(
        (c) => c.dataset.activity === activity
      );

      if (card) {
        let list = card.querySelector(".participants-list");
        // If there is no list yet ("No participants yet"), create one
        if (!list) {
          const participantsDiv = card.querySelector(".participants");
          participantsDiv.innerHTML = `<strong>Participants:</strong><ul class="participants-list"></ul>`;
          list = card.querySelector(".participants-list");
        }

        // create optimistic list item
        optimisticLi = document.createElement("li");
        optimisticLi.className = "optimistic";
        optimisticLi.innerHTML = `<span class="participant-email">${email}</span><button class="participant-delete" data-activity="${encodeURIComponent(
          activity
        )}" data-email="${encodeURIComponent(email)}" title="Unregister">✖</button>`;
        list.appendChild(optimisticLi);
      }
    } catch (err) {
      console.error("Optimistic update failed:", err);
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        // Refresh activities list so UI shows the newly-registered participant
        fetchActivities();
      } else {
        // remove optimistic item on error
        if (optimisticLi && optimisticLi.parentNode) optimisticLi.parentNode.removeChild(optimisticLi);
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      // remove optimistic item on network/local error
      if (optimisticLi && optimisticLi.parentNode) optimisticLi.parentNode.removeChild(optimisticLi);
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    } finally {
      // hide spinner and enable button
      try {
        if (signupButton) {
          const spinner = signupButton.querySelector(".spinner");
          signupButton.disabled = false;
          if (spinner) spinner.classList.add("hidden");
        }
      } catch (e) {
        console.error("Failed to hide spinner:", e);
      }
    }
  });

  // Initialize app
  // Delegate delete/unregister clicks from the activities list
  activitiesList.addEventListener("click", async (e) => {
    const target = e.target;
    if (target.classList && target.classList.contains("participant-delete")) {
      const activity = decodeURIComponent(target.dataset.activity || "");
      const email = decodeURIComponent(target.dataset.email || "");

      if (!activity || !email) return;

  // Confirmation dialog before unregistering (use custom modal)
  const confirmed = await showConfirm(`Unregister ${email} from ${activity}?`);
  if (!confirmed) return;

      try {
        const resp = await fetch(
          `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
          { method: "DELETE" }
        );

        const result = await resp.json();

        if (resp.ok) {
          messageDiv.textContent = result.message || `Unregistered ${email}`;
          messageDiv.className = "success";
          messageDiv.classList.remove("hidden");
          // Refresh activities to reflect change
          fetchActivities();
        } else {
          messageDiv.textContent = result.detail || "Failed to unregister";
          messageDiv.className = "error";
          messageDiv.classList.remove("hidden");
        }

        // Auto-hide message
        setTimeout(() => messageDiv.classList.add("hidden"), 5000);
      } catch (err) {
        console.error("Error unregistering:", err);
        messageDiv.textContent = "Failed to unregister. Please try again.";
        messageDiv.className = "error";
        messageDiv.classList.remove("hidden");
      }
    }
  });

  fetchActivities();
});
