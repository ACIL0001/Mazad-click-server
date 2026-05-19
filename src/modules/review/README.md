# Review Module

This module provides endpoints and logic for user-to-user likes and dislikes, and adjusts user ratings accordingly.

## Endpoints
- `POST /review/like/:userId` — Like a user (authenticated)
- `POST /review/dislike/:userId` — Dislike a user (authenticated)

## Logic
- Each user can only like or dislike another user once, but can change their review.
- When a user receives 10 likes, their `rate` increases by 1 (max 10), and their like reviews are reset.
- When a user receives 2 dislikes, their `rate` decreases by 1 (min 1), and their dislike reviews are reset.
- Reviews store timestamps for creation and updates. 