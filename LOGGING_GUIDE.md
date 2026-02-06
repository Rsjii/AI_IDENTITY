# 🔍 Complete A-Z Logging Guide

## Overview

Comprehensive logging has been added throughout the RAG/LLM flow to track:
- Data retrieval from database
- Data storage operations
- RAG retrieval process
- LLM API calls
- Response generation
- Complete flow verification

---

## 📋 Logging Flow (A-Z)

### **1. Public Chat Controller (`publicController.ts`)**

#### Step 1: Request Initiation
```
[PUBLIC_CHAT] 🚀 Starting chat request
- step: 1_INIT
- slug, messageLength, visitorId, sessionId, viewerUserId
```

#### Step 2: Creator Lookup
```
[PUBLIC_CHAT] ✅ Creator found in database
- step: 2_CREATOR_FOUND
- creatorId, creatorEmail, creatorHandle, planTier
```

#### Step 5: Saving User Message
```
[PUBLIC_CHAT] 💾 Saving user message to database
- step: 5_SAVING_USER_MESSAGE
- sessionId, messageLength, messagePreview
```

#### Step 6: User Message Saved
```
[PUBLIC_CHAT] ✅ User message saved to chat_messages table
- step: 6_USER_MESSAGE_SAVED
- messageId, sessionId
```

#### Step 7-9: AI Response Generation
```
[PUBLIC_CHAT] 👤 Owner chatting with own AI - unlimited access
[PUBLIC_CHAT] 🤖 AI response generated
[PUBLIC_CHAT] ✅ AI response saved to chat_messages table
```

#### Step 10-12: Free Message Flow
```
[PUBLIC_CHAT] 🆓 Free message - generating full response
[PUBLIC_CHAT] 🤖 Free response generated
[PUBLIC_CHAT] ✅ Free response saved - request complete
```

---

### **2. RAG Service (`ragService.ts`)**

#### RAG_1: Start Retrieval
```
[RAG] 🔍 Starting RAG retrieval
- step: RAG_1_START
- userId, queryLength, queryPreview, maxChunks, maxTokens, minSimilarity
```

#### RAG_2: Chunks Loaded
```
[RAG] 📚 Knowledge chunks loaded from database
- step: RAG_2_CHUNKS_LOADED
- totalChunks, chunksWithEmbeddings, chunksWithoutEmbeddings
```

#### RAG_3: No Chunks Warning
```
[RAG] ⚠️ No knowledge chunks found for user
- step: RAG_3_NO_CHUNKS
```

#### RAG_4-5: Query Embedding
```
[RAG] 🔢 Generating embedding for user query
[RAG] ✅ Query embedding generated
- embeddingDimensions, model, tokensUsed, cost
```

#### RAG_6-7: Similarity Search
```
[RAG] 🔎 Finding similar chunks using cosine similarity
[RAG] ✅ Similarity search complete
- similarChunksFound, topSimilarities
```

#### RAG_8: Token Limit
```
[RAG] ⚠️ Token limit reached, stopping chunk selection
- currentTokens, maxTokens, chunksSelected
```

#### RAG_9: Retrieval Complete
```
[RAG] ✅ Retrieved X chunks (~Y tokens) in Zms
- selectedChunks, totalTokensEstimate, retrievalTimeMs
- avgSimilarity, selectedChunksDetails (with content previews)
```

#### Cache Operations
```
[RAG] 💾 Cache hit - using cached chunks
[RAG] 📊 Querying database for knowledge chunks
[RAG] ✅ Database query complete
[RAG] 💾 Cache updated with fresh chunks
```

---

### **3. LLM/Identity Service (`identityService.ts`)**

#### LLM_1: RAG Start
```
[LLM] 🔍 Starting RAG retrieval for LLM context
- step: LLM_1_RAG_START
- userId, incomingMessageLength, messagePreview
```

#### LLM_2: RAG Success/Error
```
[LLM] ✅ RAG retrieved X chunks (~Y tokens) - context built
- chunksUsed, tokensEstimate, retrievalTimeMs
- contextPreview, chunkDetails (similarity + content preview)

OR

[LLM] ⚠️ RAG returned no chunks - proceeding without knowledge base context
[LLM] ❌ RAG failed - proceeding without context
```

#### LLM_3: Context Built
```
[LLM] 📝 Context built - ready for LLM call
- hasRagContext, ragContextLength, additionalContextLength
- enrichedContextLength, totalTokensEstimate
```

#### LLM_4: Calling LLM
```
[LLM] 🤖 Calling LLM API...
- attempt, maxAttempts, isTeaser, maxTokens
- systemPromptLength, userPromptLength
```

#### LLM_5: Response Received
```
[LLM] ✅ LLM response received
- model, inputTokens, outputTokens, replyLength
- replyPreview, cost
```

#### LLM_6: Rules Applied
```
[LLM] 📋 Rules applied to response
- rulesCount, rules
```

#### LLM_7: Saving to DB
```
[LLM] 💾 Saving LLM run to mirror_runs table
- replyLength, model, tokensIn, tokensOut
- costCents, latencyMs, validatorStatus
```

#### LLM_8-9: Chat Message Saved
```
[LLM] 💾 Saving assistant message to chat_messages table
[LLM] ✅ Chat message saved - complete
- messageId, totalDuration
```

---

### **4. Database Operations (`database.ts`)**

#### Chat Message Insert
```
[DB] 💾 Inserting chat message
- step: DB_CHAT_MESSAGE_INSERT
- messageId, sessionId, role, contentLength, truncated

[DB] ✅ Chat message inserted successfully
- step: DB_CHAT_MESSAGE_INSERTED
- messageId, sessionId, createdAt
```

---

## 🔍 Verification Script

### **Usage:**
```bash
node backend/scripts/verify-rag-flow.js <user-email>
```

### **What it checks:**
1. ✅ User exists in database
2. ✅ Identity configured
3. ✅ Knowledge sources uploaded
4. ✅ Knowledge chunks created
5. ✅ Embeddings generated
6. ✅ Training jobs status
7. ✅ Chat sessions created
8. ✅ Chat messages saved
9. ✅ LLM calls logged (mirror_runs)
10. ✅ Recent chat examples

### **Output:**
- Complete summary of all data
- Warnings for missing embeddings
- Cost tracking
- Recent chat examples

---

## 📊 Log Levels

- **INFO**: Normal flow operations (RAG retrieval, LLM calls, DB saves)
- **DEBUG**: Detailed operations (cache hits, DB queries, rules)
- **WARN**: Issues that don't break flow (no chunks, RAG fallback)
- **ERROR**: Critical failures (RAG errors, DB failures)

---

## 🎯 Key Log Patterns to Monitor

### **1. RAG Working Correctly:**
```
[RAG] ✅ Retrieved X chunks (~Y tokens) in Zms
[LLM] ✅ RAG retrieved X chunks (~Y tokens) - context built
```

### **2. Embeddings Missing:**
```
[RAG] ⚠️ No embeddings found, using keyword fallback
⚠️  WARNING: X chunks missing embeddings!
```

### **3. LLM Call Success:**
```
[LLM] ✅ LLM response received
[LLM] 💾 Saving LLM run to mirror_runs table
```

### **4. Data Storage:**
```
[PUBLIC_CHAT] ✅ User message saved to chat_messages table
[LLM] ✅ Chat message saved - complete
[DB] ✅ Chat message inserted successfully
```

---

## 🔧 Debugging Tips

### **If RAG not retrieving chunks:**
1. Check: `[RAG] 📚 Knowledge chunks loaded from database`
2. Verify: `chunksWithEmbeddings > 0`
3. Check training job status

### **If LLM not using knowledge:**
1. Check: `[LLM] ✅ RAG retrieved X chunks`
2. Verify: `hasRagContext: true`
3. Check: `contextPreview` shows knowledge content

### **If responses not saved:**
1. Check: `[LLM] 💾 Saving assistant message`
2. Verify: `sessionId` exists
3. Check: `persistChat: true`

---

## 📝 Example Complete Flow Log

```
[PUBLIC_CHAT] 🚀 Starting chat request
[PUBLIC_CHAT] ✅ Creator found in database
[PUBLIC_CHAT] 💾 Saving user message to database
[PUBLIC_CHAT] ✅ User message saved to chat_messages table
[LLM] 🔍 Starting RAG retrieval for LLM context
[RAG] 🔍 Starting RAG retrieval
[RAG] 📚 Knowledge chunks loaded from database
[RAG] 🔢 Generating embedding for user query
[RAG] ✅ Query embedding generated
[RAG] 🔎 Finding similar chunks using cosine similarity
[RAG] ✅ Similarity search complete
[RAG] ✅ Retrieved 3 chunks (~450 tokens) in 120ms
[LLM] ✅ RAG retrieved 3 chunks (~450 tokens) - context built
[LLM] 📝 Context built - ready for LLM call
[LLM] 🤖 Calling LLM API...
[LLM] ✅ LLM response received
[LLM] 💾 Saving LLM run to mirror_runs table
[LLM] 💾 Saving assistant message to chat_messages table
[LLM] ✅ Chat message saved - complete
[PUBLIC_CHAT] ✅ Free response saved - request complete
```

---

## ✅ Success Indicators

All these logs should appear in a successful flow:
- ✅ `[PUBLIC_CHAT] ✅ Creator found`
- ✅ `[PUBLIC_CHAT] ✅ User message saved`
- ✅ `[RAG] ✅ Retrieved X chunks`
- ✅ `[LLM] ✅ RAG retrieved X chunks`
- ✅ `[LLM] ✅ LLM response received`
- ✅ `[LLM] ✅ Chat message saved`
- ✅ `[DB] ✅ Chat message inserted`

---

**Last Updated:** Complete A-Z logging implemented
**Status:** ✅ Ready for testing and debugging

