\# EduTic Design Skill



\## Goal



When implementing EduTic screens, do not improvise visual design. Match the provided reference images as closely as possible.



The app must look like a premium magical 3D educational game, not like a generic dashboard.



\## Core visual style



\- Full-screen dreamy sky backgrounds.

\- Floating islands and mascots must come from image assets, never from CSS drawings.

\- UI overlays use soft glassmorphism.

\- Rounded corners are large.

\- Shadows are soft and colorful.

\- Gradients use turquoise, purple, mint, blue and soft pink.

\- Text must be bold, friendly and readable.

\- All UI must feel polished, airy and magical.



\## Login card reference



The login card must match the reference design:



\- Centered between mascots.

\- Width: 520px to 590px.

\- Height: 760px to 830px depending on viewport.

\- Border radius: 34px to 44px.

\- Background: rgba(255, 255, 255, 0.58) or similar.

\- Backdrop blur: 22px to 30px.

\- Border: 1px solid rgba(255, 255, 255, 0.85).

\- Outer shadow: 0 30px 90px rgba(80, 70, 180, 0.28).

\- Add a soft turquoise/purple/pink glow around the top and right edges.

\- Add subtle decorative sparkles inside the card.

\- Do not use a flat blue/white rectangle.



\## Login card layout



Vertical order:



1\. EduTic logo area

2\. Main title

3\. Subtitle

4\. Small divider with “Tu rol”

5\. 2x2 role selector

6\. Username input

7\. Password input

8\. Primary button

9\. Demo button

10\. Small safety text



\## Logo



\- Do not use a small square “E” icon as the main brand.

\- Use large “EduTic” text/logo.

\- Logo should visually dominate the top of the card.

\- Suggested size: 48px to 58px font size.

\- Use blue/turquoise/green/purple accent colors.

\- Optional star icon may appear beside the logo.



\## Typography



Use a rounded friendly font if available.



Recommended:

\- Baloo 2

\- Nunito

\- Fredoka

\- Quicksand



If not available, use system fallback but keep font-weight strong.



Title:

\- 40px to 48px

\- font-weight: 800 or 900

\- color: #18325f or similar deep navy



Subtitle:

\- 17px to 20px

\- color: #52658f

\- medium weight



Labels:

\- 14px to 16px

\- font-weight: 700

\- color: #596994



\## Role selector



Must look like polished pill cards.



\- 2 columns x 2 rows.

\- Gap: 14px to 16px.

\- Button height: 62px to 68px.

\- Border radius: 18px to 22px.

\- Inactive background: rgba(255,255,255,0.72).

\- Active background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(220,245,255,0.65)).

\- Active border: 2px solid #5ff3d4 or #9b7cff.

\- Active glow: 0 0 22px rgba(118, 92, 255, 0.25).

\- Add small icons.

\- Add hover and click animation.



\## Inputs



\- Height: 58px to 64px.

\- Border radius: 18px to 22px.

\- Background: rgba(255,255,255,0.72).

\- Border: 1px solid rgba(130,140,190,0.22).

\- Focus border: #73f3dc.

\- Focus shadow: 0 0 0 4px rgba(115,243,220,0.25).

\- Left icon.

\- Password field should have eye icon on the right.



\## Buttons



Primary button:

\- Height: 62px to 68px.

\- Border radius: 22px.

\- Background: linear-gradient(90deg, #54e8c6, #25c8df, #536bff).

\- White bold text.

\- Soft shadow: 0 14px 30px rgba(35, 190, 210, 0.35).

\- Add sparkle icon on the left and arrow on the right.

\- Hover: translateY(-2px), brightness(1.03).

\- Active: scale(0.98).



Demo button:

\- Height: 56px to 62px.

\- Background: rgba(255,255,255,0.78).

\- Text color: #405083 or #5e4edb.

\- Rocket icon.

\- Soft border.



\## Background and mascots



\- Use login-sky-islands-bg.png as a full-screen background.

\- Use mascot mascot-women-wave.png on the left.

\- Use mascot mascot-wave.png on the right.

\- Mascots must not have white backgrounds.

\- Do not crop mascots.

\- Do not stretch mascots.

\- Keep them outside the card and visually framing it.



\## Implementation rules



\- Do not create fake islands with CSS.

\- Do not generate new images.

\- Do not modify original images.

\- If a processed copy is required, create a copy only.

\- Do not use generic admin dashboard styling.

\- Avoid thick borders.

\- Avoid opaque blocks.

\- Use CSS variables for design tokens.

\- Keep components reusable.



\## Screenshot matching



After implementing a screen:



1\. Run the app.

2\. Take a screenshot.

3\. Compare visually against the reference image.

4\. Fix spacing, proportions, colors, blur, radius and shadows.

5\. Repeat until the screen is visually close.



Do not stop after the first implementation if it does not match the reference.

