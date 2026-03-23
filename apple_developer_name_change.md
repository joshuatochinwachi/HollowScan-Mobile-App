# Technical Report: App Store Developer Name Update Requirements

---

## 1. Executive Summary
Changing the public-facing developer name on the Apple App Store is not a metadata update or a build-level change. It is a **Legal Identity Correction**. 

Because the account was enrolled as an **Individual**, Apple strictly mandates the use of the legal owner's name. Metadata changes or submitting a new `.ipa` build **will not** trigger a name change on the App Store product page.

## 2. Why a New App Build Will Not Work
It has been proposed to submit a minor update to force a name refresh. Technical research and Apple’s internal logic confirm this will fail:

*   **Account vs. Application:** The "Seller Name" is an attribute of the **Developer Program Membership (Account level)**, not the **Application Binary (Build level)**. 
*   **Static Legal Field:** When a new build is approved, Apple refreshes the "What's New" and "Version" fields. It does **not** re-verify or change the legal entity holding the contract.
*   **Source:** [Apple Developer Forums - Seller Name Persistence](https://developer.apple.com/forums/thread/813734)

## 3. The "Individual" vs. "Organization" Barrier
Apple recognizes two primary types of memberships. The current account is an **Individual** account.

| Feature | Individual Account | Organization Account |
| :--- | :--- | :--- |
| **Public Seller Name** | Must be the person's Legal Name | Can be the Company Name |
| **Developer Name** | Defaults to Legal Name | Defaults to Company/Brand Name |
| **Legal Status** | Sole Proprietor / Individual | Registered Entity (LLC, Corp, etc.) |

**Official Policy:** *"If you are enrolled as an individual, your personal name is listed as the seller."*  
**Link:** [Apple Support - Distributing on the App Store](https://developer.apple.com/support/compare-memberships/)

## 4. Required Evidence for "HollowScan"
To display **HollowScan**, Apple requires proof of a registered business entity. They verify this via the **D-U-N-S Number** (a global standard for business identification).

*   **Step 1:** Verify the legal registration of "HollowScan" (LLC or similar).
*   **Step 2:** Obtain a D-U-N-S Number for HollowScan. [Request/Verify here](https://www.dnb.com/duns-number/get-a-duns.html).
*   **Step 3:** Contact Apple Support specifically to **"Convert Individual Membership to Organization Membership."**

## 5. Official Verification Links for Management
To confirm these requirements, please refer to the official Apple Developer documentation:

1.  **Updating Account Information:** [Apple Developer Help - Membership Changes](https://developer.apple.com/help/account/membership/updating-your-account-information/)
    *   *See section: "Switching your membership from an individual to an organization."*
2.  **D-U-N-S Number Overview:** [Apple Developer Support - D-U-N-S](https://developer.apple.com/support/D-U-N-S/)
3.  **App Store Connect Help:** [Public Seller Name Guidelines](https://help.apple.com/app-store-connect/#/dev23805908b)

## 6. Recommended Action Plan
1.  **Cease Build Submissions:** Do not spend developer time on "minor changes" to the app code for the purpose of a name change; it will yield no result.
2.  **Organization Conversion:** Initiate the Apple Developer Support request to transition the account from "Lee Smith" to "HollowScan (Organization)."
3.  **Legal Document Prep:** Ensure business registration papers are ready for Apple's verification call.

