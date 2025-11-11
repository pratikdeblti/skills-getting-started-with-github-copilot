"""Test suite for the Mergington High School Activities API."""

import pytest


class TestActivities:
    """Tests for the /activities endpoint."""

    def test_get_activities_returns_all_activities(self, client):
        """GET /activities should return all activities with their details."""
        response = client.get("/activities")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that we have activities
        assert isinstance(data, dict)
        assert len(data) > 0
        
        # Check structure of activities
        assert "Chess Club" in data
        assert "Programming Class" in data
        
        # Check activity structure
        activity = data["Chess Club"]
        assert "description" in activity
        assert "schedule" in activity
        assert "max_participants" in activity
        assert "participants" in activity
        assert isinstance(activity["participants"], list)

    def test_get_activities_returns_correct_participant_count(self, client):
        """GET /activities should return correct participant counts."""
        response = client.get("/activities")
        data = response.json()
        
        # Chess Club starts with 2 participants
        assert len(data["Chess Club"]["participants"]) == 2
        assert "michael@mergington.edu" in data["Chess Club"]["participants"]
        assert "daniel@mergington.edu" in data["Chess Club"]["participants"]


class TestSignup:
    """Tests for the POST /activities/{activity_name}/signup endpoint."""

    def test_signup_success(self, client):
        """Should successfully sign up a new participant."""
        response = client.post(
            "/activities/Chess Club/signup?email=newstudent@mergington.edu"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "newstudent@mergington.edu" in data["message"]

    def test_signup_adds_participant_to_activity(self, client):
        """Signup should add the participant to the activity's list."""
        email = "testuser@mergington.edu"
        
        # Sign up
        response = client.post(
            f"/activities/Chess Club/signup?email={email}"
        )
        assert response.status_code == 200
        
        # Verify participant was added
        activities = client.get("/activities").json()
        assert email in activities["Chess Club"]["participants"]

    def test_signup_duplicate_email_fails(self, client):
        """Should reject signup for duplicate email."""
        email = "michael@mergington.edu"  # Already signed up
        
        response = client.post(
            f"/activities/Chess Club/signup?email={email}"
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "already signed up" in data["detail"].lower()

    def test_signup_nonexistent_activity_fails(self, client):
        """Should reject signup for non-existent activity."""
        response = client.post(
            "/activities/Nonexistent Activity/signup?email=test@mergington.edu"
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_signup_trims_whitespace_in_email(self, client):
        """Should handle emails with whitespace correctly."""
        email = " testuser@mergington.edu "
        
        response = client.post(
            f"/activities/Chess Club/signup?email={email}"
        )
        
        assert response.status_code == 200

    def test_signup_case_insensitive_duplicate_check(self, client):
        """Should reject duplicate signup regardless of case."""
        # michael@mergington.edu is already signed up
        email = "MICHAEL@MERGINGTON.EDU"
        
        response = client.post(
            f"/activities/Chess Club/signup?email={email}"
        )
        
        assert response.status_code == 400
        assert "already signed up" in response.json()["detail"].lower()


class TestUnregister:
    """Tests for the DELETE /activities/{activity_name}/unregister endpoint."""

    def test_unregister_success(self, client):
        """Should successfully unregister a participant."""
        email = "michael@mergington.edu"  # Already in Chess Club
        
        response = client.delete(
            f"/activities/Chess Club/unregister?email={email}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "unregistered" in data["message"].lower() or "unregister" in data["message"].lower()

    def test_unregister_removes_participant(self, client):
        """Unregister should remove the participant from the activity."""
        email = "michael@mergington.edu"
        
        # Verify they're in the activity before
        activities = client.get("/activities").json()
        assert email in activities["Chess Club"]["participants"]
        
        # Unregister
        response = client.delete(
            f"/activities/Chess Club/unregister?email={email}"
        )
        assert response.status_code == 200
        
        # Verify they're removed
        activities = client.get("/activities").json()
        assert email not in activities["Chess Club"]["participants"]

    def test_unregister_nonexistent_participant_fails(self, client):
        """Should reject unregister for non-existent participant."""
        response = client.delete(
            "/activities/Chess Club/unregister?email=nonexistent@mergington.edu"
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_unregister_nonexistent_activity_fails(self, client):
        """Should reject unregister for non-existent activity."""
        response = client.delete(
            "/activities/Nonexistent Activity/unregister?email=test@mergington.edu"
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()

    def test_unregister_case_insensitive_match(self, client):
        """Should find participant to unregister regardless of case."""
        email = "MICHAEL@MERGINGTON.EDU"  # michael@mergington.edu is signed up
        
        response = client.delete(
            f"/activities/Chess Club/unregister?email={email}"
        )
        
        assert response.status_code == 200
        
        # Verify removed
        activities = client.get("/activities").json()
        assert "michael@mergington.edu" not in activities["Chess Club"]["participants"]


class TestIntegration:
    """Integration tests combining signup and unregister."""

    def test_signup_then_unregister(self, client):
        """Should be able to sign up and then unregister."""
        email = "integrationtest@mergington.edu"
        activity = "Programming Class"
        
        # Sign up
        response = client.post(
            f"/activities/{activity}/signup?email={email}"
        )
        assert response.status_code == 200
        
        # Verify in list
        activities = client.get("/activities").json()
        assert email in activities[activity]["participants"]
        
        # Unregister
        response = client.delete(
            f"/activities/{activity}/unregister?email={email}"
        )
        assert response.status_code == 200
        
        # Verify removed
        activities = client.get("/activities").json()
        assert email not in activities[activity]["participants"]

    def test_multiple_signups_to_different_activities(self, client):
        """Should be able to sign up to multiple activities."""
        email = "multiactivity@mergington.edu"
        
        # Sign up to Chess Club
        response = client.post(
            f"/activities/Chess Club/signup?email={email}"
        )
        assert response.status_code == 200
        
        # Sign up to Programming Class
        response = client.post(
            f"/activities/Programming Class/signup?email={email}"
        )
        assert response.status_code == 200
        
        # Verify in both
        activities = client.get("/activities").json()
        assert email in activities["Chess Club"]["participants"]
        assert email in activities["Programming Class"]["participants"]
