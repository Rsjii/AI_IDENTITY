1. password me view option / eye wala icon
2. ek wo popup waale jo card hote hai na jo upar aate hai deafult js, usko replace karna custom se
3. agar koi unauthenticate duser kisi pe authenticated link pe jaaye show error sahi se do not allow
4. otp resend wala option



✅ COMPLETE FLOW CONFIRMATION:
1. File Select → Staged (NOT Uploaded)
Kya hota hai:

User file select karta (drag/drop ya Choose Files)
stageFile() function call hoti (OnboardingContentPage.tsx:101)
File stagedFiles array mein add hoti
Backend pe upload NAHI hota ❌
Training start NAHI hoti ❌
Toast dikhta: "filename.pdf added (will upload on Continue)"
Proof: Lines 404, 136 - stageFile() called, NOT uploadFile()

2. Staged File Calculations (Client-Side)
Calculations kaise hoti hai:

File size:


stagedFile.file.size  // Direct File object se
Word count estimate:


estimatedWords = Math.ceil(file.size / 6)  // Line 124
// Example: 100KB file = ~17,000 words
Total calculations (Real-time):


// Line 67-68: Staged files ka total
stagedWords = stagedFiles.reduce((sum, sf) => sum + sf.estimatedWords, 0)
stagedSize = stagedFiles.reduce((sum, sf) => sum + sf.file.size, 0)

// Line 71-72: Uploaded + Staged combined
totalWords = uploadedWords + stagedWords
totalSize = uploadedSize + stagedSize

// Line 76-78: Training time (size-based)
totalSizeMB = totalSize / (1024 * 1024)
estimatedMinutes = Math.max(5, Math.ceil(totalSizeMB * 5))
RIGHT SIDEBAR UPDATE: Automatically updates kyunki ye calculations har render pe run hoti hai (reactive)

3. File Delete → Calculation Update
Kya hota hai:

User staged file pe X button click karta (OnboardingContentPage.tsx:452)
removeStagedFile(id) call hoti
File stagedFiles array se remove hoti (line 138):

setStagedFiles(prev => prev.filter(sf => sf.id !== id))
React re-renders
Calculations automatically re-run (lines 67-72)
Right sidebar stats instantly update ✅
No backend call - sirf frontend state change

4. Continue Click → Upload + Training
Final flow (OnboardingContentPage.tsx:621-648):


// STEP 1: Upload all staged files
for (const stagedFile of stagedFiles) {
  await uploadFile(stagedFile.file);  // Backend pe upload
}
// Backend receives file → Processes → Starts training (async)

// STEP 2: Clear staged files
setStagedFiles([]);

// STEP 3: Mark onboarding complete
await apiFetch('/api/creator/onboarding/complete', {...});

// STEP 4: Refresh auth state
await refreshAuth();

// STEP 5: Navigate to plan page
nav('/onboarding/plan');
Training backend pe start hoti hai automatically when /api/content/upload receives file

✅ EXAMPLE WALKTHROUGH:
Scenario: User 3 files add karta

Select file1.pdf (5MB)

Staged → stagedFiles = [file1]
Calculation: 5MB → ~25 mins training
Right sidebar shows: "~25 mins"
Select file2.docx (3MB)

Staged → stagedFiles = [file1, file2]
Calculation: 8MB → ~40 mins training
Right sidebar shows: "~40 mins"
Remove file1.pdf

removeStagedFile() → stagedFiles = [file2]
Calculation: 3MB → ~15 mins training
Right sidebar shows: "~15 mins" ✅
Add file3.txt (2MB)

Staged → stagedFiles = [file2, file3]
Calculation: 5MB → ~25 mins training
Right sidebar shows: "~25 mins"
Click Continue

Upload file2.docx → Backend training starts
Upload file3.txt → Backend training starts
stagedFiles cleared
Navigate to plan page
✅ CONFIRMATION:
Requirement	Status	Implementation
File select pe staged only (no upload)	✅	stageFile() adds to array, no API call
Staged file calculations correct	✅	Client-side: file.size / 6 for words, size * 5min/MB for time
Delete removes from calculation	✅	filter() removes + React re-renders + calculations auto-update
Continue pe upload + training	✅	Loop through staged files → upload → backend trains
Sab perfect hai! 🎯

