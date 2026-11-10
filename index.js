import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URL);

try {
  await client.connect();
  console.log("You successfully connected to MongoDB!");
} catch (err) {
  console.error("Failed to connect to MongoDB:", err);
  process.exit(1);
}

const db = client.db("wanderlust");
const destinationCollection = db.collection("destination");
const bookingCollection = db.collection("bookings");

//middleware
const verifyToken = async(req,res,next) => {
    const authHeader = req.headers.authorization;
    if(!authHeader){
      return res.status(401).send({message: "Unauthorized!"});
    }
   
    const token = authHeader.split(" ")[1];
    if(!token){
      return res.status(401).send({message: "Unauthorized!"});
    }

    const JWKS = createRemoteJWKSet(
      new URL("http://localhost:3001/api/auth/jwks"),
    );

    try{
      const {payload} = await jwtVerify(token, JWKS);
      next();
    }
    catch(error){
      return res.status(500).send({message: "Server Down!"})
    }

    
}

// Health check endpoint
app.get('/', (req, res) => {
  res.send({ message: "Server is running..." });
});

// Destination routes
app.get('/destinations', async (req, res) => {
  try {
    const result = await destinationCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch destinations", error: error.message });
  }
});

//Featured Destination
app.get('/feature-destinations', async (req, res) => {
  try {
    const result = await destinationCollection.find().limit(5).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch destinations", error: error.message });
  }
});

app.get("/destinations/:id", verifyToken,async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid destination ID format" });
    }
    const result = await destinationCollection.findOne({ _id: new ObjectId(id) });
    if (!result) {
      return res.status(404).send({ message: "Destination not found" });
    }
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch destination", error: error.message });
  }
});

app.post('/add-destination',verifyToken, async (req, res) => {
  try {
    const data = req.body;
    const result = await destinationCollection.insertOne(data);
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to add destination", error: error.message });
  }
});

app.patch("/destinations/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid destination ID format" });
    }
    // Remove _id from updateData if present to avoid MongoServerError (immutable field)
    const { _id, ...updateData } = req.body;
    const result = await destinationCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    res.json(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to update destination", error: error.message });
  }
});

app.delete("/destinations/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid destination ID format" });
    }
    const result = await destinationCollection.deleteOne({ _id: new ObjectId(id) });
    res.json(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to delete destination", error: error.message });
  }
});

// Booking routes
app.get("/bookings",verifyToken, async (req, res) => {
  try {
    const result = await bookingCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch bookings", error: error.message });
  }
});

app.post("/bookings",verifyToken, async (req, res) => {
  try {
    // When booking includes destination details, omit the destination's _id to prevent duplicate key errors on subsequent bookings
    const { _id, ...bookingData } = req.body;
    if (_id) {
      bookingData.destinationId = _id;
    }
    const result = await bookingCollection.insertOne(bookingData);
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to create booking", error: error.message });
  }
});

app.get('/my-bookings/:email',verifyToken, async(req,res) => {
    const {email} = req.params
    const result = await bookingCollection.find({email:email}).toArray()
    res.send(result);
})

app.delete('/my-bookings/:id',verifyToken, async(req,res) => {
    const {id} = req.params
    const result = await bookingCollection.deleteOne({_id: new ObjectId(id)})
    res.send(result);
})

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});
