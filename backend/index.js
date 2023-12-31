const express = require("express");
const mongoose = require("mongoose");
const app = express();
require('dotenv').config();

const port = process.env.PORT || 3000;
var jwt = require("jsonwebtoken");
//const { auth } = require("./middleware");
const axios = require("axios");

const auth = require("./auth");
const bcrypt = require("bcryptjs");
const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
const openai_key = process.env.OPEN_AI_KEY
const dbConnect = require("./db/dbconnect");

const ProblemsModel = require("./models/problems");
const SubmissionsModel = require("./models/submissions");
const UserModel = require("./models/User");
const JWT_SECRET = "secret";
const cors = require("cors");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    msg: "hello world",
  });
});

async function saveSampleProblems() {
	try {
    const sampleProblemsFromDB = await ProblemsModel.find();
	  for (const problemData of sampleProblemsFromDB) {
		const { problemId } = problemData;
		const existingProblem = await ProblemsModel.findOne({ problemId });
  
		if (existingProblem) {
		  console.log(`Problem with problemId '${problemId}' already exists. Skipping...`);
		  continue;
		}
  
		const sampleProblem = new ProblemsModel(problemData);
		await sampleProblem.save();
		console.log(`Sample problem '${sampleProblem.title}' saved successfully!`);
	  }
	} catch (error) {
	  console.error(error);
	}
  }
  
  saveSampleProblems();

app.get("/problems", async (req, res) => {
  const problems = await ProblemsModel.find();

  res.json({
    problems: problems,
  });
});

app.get("/problem/:id", async (req, res) => {
  const id = req.params.id;
  const problem = await ProblemsModel.findOne({ problemId: id });

  if (!problem) {
    return res.status(411).json({});
  }
  res.json({
    problem,
  });
});

app.post("/chatgpt", async (req, res) => {
  try {
      const userInput = req.body.message;

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: "gpt-3.5-turbo",
          messages : [
            {
                "role": "user",
                "content": userInput
            }
        ],
      }, {
          headers: {
              Authorization: `Bearer ${openai_key}`,
              'Content-Type': 'application/json',
          },
      });
      //console.log(response.data);
      res.json({ response: response.data });
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'An error occurred' });
}
});

app.get("/me", auth, async (req, res) => {
  const user = UserModel.find({
    userId : req.userId
  });
  res.json({ user });
});

app.get("/submissions/:problemId", auth, async (req, res) => {
  const problemId = req.params.problemId;
  const submissions = await SubmissionsModel.find({
      problemId : problemId,
      userId : req.userId
  });
  res.json({
    submissions,
  });
});

app.post("/submission", auth, async (req, res) => {
  const isCorrect = Math.random() < 0.5;
  const problemId = req.body.problemId;
  const submission = req.body.submission;
  let status = isCorrect ? "WA" : "AC";

  const newSubmission = new SubmissionsModel({
		submission: submission,
		problemId: problemId,
		userId: req.userId,
		status: status,
	});
  await newSubmission.save();
	return res.json({
		status: status,
	});
});

app.post("/signup", async (req, res) => {
  try {
	    const encryptedPassword = await bcrypt.hash(req.body.password, 10);
		const existingEmail = await UserModel.findOne({
			email: req.body.email,
		});
		if (existingEmail) {
			return res.status(409).json({ message: "Email already exists!" });
		}
		
		const newUser = new UserModel({
			email: req.body.email,
			password: encryptedPassword,
		});

		await newUser.save();

		console.log("User created!");
		console.log(newUser.toJSON());
		return res.json({
			msg: "Success",
		});
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: "Server error" });
	}
});

app.post("/login", async (req, res) => {
  console.log(req.body);
  const { email, password } = req.body;

  const user = await UserModel.findOne({ email });
  if (!user) {
    return res.json({ error: "User Not found" });
  }
  if (await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user.userId }, JWT_SECRET, {
      expiresIn: "15m",
    });

    if (res.status(201)) {
      return res.json({ message: "Logged in successfully!", status: "ok", token: token });
    } else {
      return res.json({ error: "Server error" });
    }
  }
  res.json({ status: "error", error: "InvAlid Password" });
});

app.get("/free-endpoint", (req, res) => {
	res.json({ message: "You are free to access me anytime" });
  });
  
  // authentication endpoint
  app.get("/auth-endpoint", auth,  (req, res) => {
  console.log("get in");
	res.json({ message: "You are authorized to access me" });
  });

dbConnect();

app.get("/api/videos", async (req, res) => {
  try {
    const query = "coding interviews"; // Customize the search query here
      const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=3&q=${encodeURIComponent(
        query
      )}&type=video&key=${apiKey}`;
    const response = await axios.get(apiUrl);
    const videos = response.data.items;
    const videoIdsAndThumbnails = videos.map((video) => ({
      id: video.id.videoId,
      thumbnail: video.snippet.thumbnails.default.url,
    }));
    res.json(videoIdsAndThumbnails);
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
