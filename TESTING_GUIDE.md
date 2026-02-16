# 🧪 Testing Guide - Priority 1 APIs

## ✅ **Step 1: Check Prerequisites**

### Required:
1. ✅ Node.js installed (v14+)
2. ✅ MongoDB running locally or connection string
3. ✅ All dependencies installed

### Install Dependencies:
```bash
cd server
npm install
```

---

## ✅ **Step 2: Start MongoDB**

### Windows:
```bash
# If MongoDB is installed as service, it should be running
# Or start manually:
mongod
```

### Check MongoDB:
- Default: `mongodb://127.0.0.1:27017/nearnect`
- Or set `MONGO_URI` in `.env` file

---

## ✅ **Step 3: Start Server**

```bash
cd server
npm start
# or for development with auto-reload:
npm run dev
```

### Expected Output:
```
Connected to MongoDB
API listening on http://localhost:4000
```

### If Error:
- Check MongoDB is running
- Check PORT 4000 is available
- Check all dependencies installed

---

## ✅ **Step 4: Test APIs**

### 4.1 Test Health Check (No Auth Required)
```bash
GET http://localhost:4000/health
```
**Expected:** `{ "ok": true, "service": "nearnect-api" }`

---

### 4.2 Test Authentication

#### Signup:
```bash
POST http://localhost:4000/auth/signup
Content-Type: application/json

{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "1234567890",
  "password": "test1234",
  "role": "customer"
}
```

#### Login:
```bash
POST http://localhost:4000/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "test1234"
}
```

**Save the token** from response for next requests!

---

### 4.3 Test Workers API (No Auth Required)

```bash
GET http://localhost:4000/workers
GET http://localhost:4000/workers?skill=Plumber
GET http://localhost:4000/workers?minRating=4
GET http://localhost:4000/workers/skills/list
```

---

### 4.4 Test Bookings API (Auth Required)

**Create Booking:**
```bash
POST http://localhost:4000/bookings
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "workerId": "<WORKER_ID>",
  "service": "Plumber",
  "scheduledFor": "2025-01-20T10:00:00Z",
  "address": "123 Main St",
  "amount": 500
}
```

**Get Bookings:**
```bash
GET http://localhost:4000/bookings
Authorization: Bearer <YOUR_TOKEN>
```

---

### 4.5 Test Notifications API (Auth Required)

**Get Notifications:**
```bash
GET http://localhost:4000/notifications
Authorization: Bearer <YOUR_TOKEN>
```

**Mark All Read:**
```bash
POST http://localhost:4000/notifications/mark-all-read
Authorization: Bearer <YOUR_TOKEN>
```

---

### 4.6 Test Messages API (Auth Required)

**Get Conversations:**
```bash
GET http://localhost:4000/messages
Authorization: Bearer <YOUR_TOKEN>
```

**Send Message:**
```bash
POST http://localhost:4000/messages
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "recipientId": "<USER_ID>",
  "content": "Hello, are you available?"
}
```

---

### 4.7 Test Reviews API (Auth Required)

**Create Review:**
```bash
POST http://localhost:4000/reviews
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "workerId": "<WORKER_ID>",
  "rating": 5,
  "comment": "Great service!",
  "serviceQuality": 5,
  "punctuality": 5
}
```

**Get Worker Reviews:**
```bash
GET http://localhost:4000/reviews/worker/<WORKER_ID>
```

---

## 🐛 **Common Issues & Solutions**

### Issue 1: "Cannot find module"
**Solution:** Run `npm install` in server directory

### Issue 2: "MongoDB connection failed"
**Solution:** 
- Check MongoDB is running
- Check connection string in `.env` or `server/index.js`

### Issue 3: "Port 4000 already in use"
**Solution:**
- Change PORT in `.env` file
- Or kill process using port 4000

### Issue 4: "401 Unauthorized"
**Solution:**
- Check token is valid
- Token format: `Bearer <token>`
- Token might be expired, login again

### Issue 5: "404 Not Found"
**Solution:**
- Check route path is correct
- Check server is running
- Check route is registered in `server/index.js`

---

## 📝 **Quick Test Checklist**

- [ ] Server starts without errors
- [ ] Health check works
- [ ] Can signup new user
- [ ] Can login and get token
- [ ] Can search workers
- [ ] Can create booking (with token)
- [ ] Can get notifications (with token)
- [ ] Can send message (with token)
- [ ] Can create review (with token)

---

## 🎯 **Next Steps After Testing**

1. ✅ If all tests pass → Ready for frontend integration
2. ⚠️ If errors → Fix issues first
3. 🚀 Then move to Priority 2 features

---

**Happy Testing! 🎉**

