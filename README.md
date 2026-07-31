# Willie Lab Tech Portal

Build a full-stack employment empowerment portal called "WILLIE LAB TECH" for young engineers to apply for opportunities.

‎

‎COLOR SCHEME: Use a green, orange, and white color combination throughout. Green (#1b5e20 dark green, #2e7d32 lighter green) as the primary/dominant color for headers, navigation, and backgrounds. Orange (#f57c00) as the accent color for buttons and highlights. White as a supporting/background color for contrast and readability. Keep this color combination consistent on every page.

‎

‎IMAGES: I am uploading 3 images:

‎1. A circular logo with a camera graphic and "WILL'S PHOTOGRAPHIC STUDIO LTD" text — place this logo at the top center of the homepage/welcome page, and also in the navigation bar on every other page.

‎2. A photo of me sitting at an office desk using a laptop — place this image on the welcome/homepage, directly below the logo, before the apply/login buttons.

‎3. A photo of me standing outside in front of a gated property with a car — place this image further down the homepage, below the "About This Empowerment" section, as the sponsor photo.

‎

‎HOMEPAGE LAYOUT (in this order, top to bottom):

‎1. Logo (top center)

‎2. Office photo (image 2)

‎3. Portal title: "WILLIE LAB TECH"

‎4. A button "Apply Now" (orange) that goes to registration

‎5. Below it, a button "Login (Already have an account)" (green) that goes to login

‎6. Below that, a separate button "Login as Admin" for admin access

‎7. A section titled "About This Empowerment" containing this exact text: "This empowerment is from Willie Lab Tech to empower young engineers to fit into their field and find opportunities to make their dreams come true. This empowerment is currently requesting for 10,000 engineers from different fields, and applications start from 29th of July to 10th of August 2026. This empowerment is sponsored by Engr. Willie Effiong."

‎8. The outside/gate photo (image 3) below that section

‎

‎APPLICANT ACCOUNT FLOW:

‎- Registration page: Full Name, Email, Password fields

‎- After registering, send an email with a 6-digit OTP code to the applicant's email to verify their account

‎- OTP verification page where they input the code

‎- Once verified, show "Your account has been successfully created" then send them to Login

‎- Login page: Email and Password

‎

‎APPLICANT DASHBOARD (after login):

‎- Welcome message with their name

‎- Application status indicator (pending / accepted / rejected)

‎- Notifications section: shows updates when admin accepts/rejects their application

‎- Profile section where they can fill in and save: Gender, Date of Birth, State, Local Government Area, Educational Qualification, and a Notes/Skills description text box

‎- Document upload section: allow uploading multiple documents/files, and list uploaded documents so they can view them afterward

‎- Logout option

‎

‎ADMIN ACCOUNT:

‎- Separate Admin Login page (not visible from regular applicant login)

‎- Admin email: willieeffiong52@gmail.com

‎- Admin password: willie44?

‎- Admin Dashboard shows: total number of applicants, a list of all applicants with their status

‎- Clicking an applicant shows their full profile, documents, and details

‎- Admin can click "Accept" to approve an application, or "Reject" with an optional reason text

‎- When admin accepts or rejects, automatically send the applicant an email notification informing them to check the portal for an update (do not put the full feedback content in the email itself — feedback details should only be visible inside the applicant's dashboard on the portal)

‎- Admin also gets an email notification whenever a new applicant registers

‎

‎TECHNICAL REQUIREMENTS:

‎- Real user authentication with secure password storage

‎- A database to store applicant accounts, profiles, documents, and application status

‎- Email sending integration for OTP codes and notifications

‎- Mobile-friendly, responsive design

‎- Professional, clean layout throughout, consistently using the green/orange/white color scheme

‎

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://willieemploymentportal.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/76821bdf-f10a-4dbc-a8d7-7aba51a9db65).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
