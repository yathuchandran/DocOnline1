require("dotenv").config();
const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const mailSender = require("../config/nodeMailer");
const { createTokens } = require("../middlewares/jwt");
const cloudinary = require("cloudinary");
const randomstring = require("randomstring");
const Department = require("../models/department");
const Doctor = require("../models/doctorModel");
const Appointment = require("../models/appointmentModel");
const Schedule = require("../models/scheduleModel");
const stripe = require("stripe")(`${process.env.STRIPE_KEY}`);




async function securePassword(password) {
  try {
    const hashPassword = await bcrypt.hash(password, 10);
    return hashPassword;
  } catch (error) {
    res.json("error");
  }
}



const signup = async (req, res) => {
  try {
    const { Name, Email, Mobile, Password } = req.body;
    const exist = await User.findOne({ email: Email });
    if (exist) {
      res.json("email already exist");
    } else {
      const hashedPassword = await securePassword(Password);
      const otp = Math.floor(1000 + Math.random() * 9000);
      console.log(otp, "otp 32");
      const string = randomstring.generate();
      const user = new User({
        userName: Name,
        email: Email,
        contact: Mobile,
        password: hashedPassword,
        otp: otp,
        token: string,
      });
      console.log(user,"user----------");

      const userData = await user.save();
      console.log(userData,"userdat----------");

      if (userData) {
        await mailSender(Email, otp, "signup");
        const data = {
          message: "Check mail",
          string: string,
        };
        res.json(data);
      }
    }
  } catch (error) {
    res.json("error");
  }
};

const verifyOtp = async (req, res) => {
  console.log("verifyOtp=user");
  try {
    const { otp } = req.body;
    const user = await User.findOne({ otp });
    if (user.otp != otp) {
      res.json("invalid");
    } else {
      console.log("inside else");
      await User.findOneAndUpdate({ $set: { otp: "" } });
      res.status(200).json({ message: "user otp correct" });
    }
    console.log(user, "user 107");
  } catch (error) {
    console.log(error);
  }
};

const login = async (req, res) => {
  console.log("login");
  try {
    console.log("login---------------");

    const { email, password } = req.body;
    const userData = await User.findOne({ email: email });
    if (userData) {
      const passwordMatch = await bcrypt.compare(password, userData.password);
      if (passwordMatch) {
        if (userData.isVerified === false) {
          if (!userData.isBlocked) {
            const token = createTokens(userData._id);
            res.status(200).json({ userData, token });
          } else {
            res.json("blocked");
          }
        } else {
          res.json("unverified");
        }
      } else {
        res.json("unauthorized");
      }
    } else {
      res.json("unauthorized");
    }
  } catch (error) {
    res.status(500).json({ error: "An error occurred" });
  }
};

const userData = async (req, res) => {
  try {
    const userData = await User.findOne({ _id: req._id.id });
    if (userData) {
      res.status(200).json(userData);
    } else {
      res.status(404).json(userData);
    }
  } catch (error) {}
};


const findDoctors = async (req, res) => {
  console.log("findDoctors-------------122");
  try {
    const docs = await Doctor.aggregate([
      {
        $match: {
          isRegister: true,
          isBlocked: false,
          isVerified: true,
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "department",
          foreignField: "name",
          as: "doctorData",
        },
      },
    ]);

    const deps = await Department.find({ isBlocked: false });
    res.json({ docs, deps });

    console.log(docs,"docs-----------------------143");

  } catch (error) {
    res.json("error");
  }
};



const searchDoc = async (req, res) => {
  console.log("searchDoc=========188");
  try {
    const searchKey = req.params.searchKey;
    console.log(searchKey);
    let data =[]
    if (searchKey == "all") {
      data = await Doctor.aggregate([
        {
          $match: {
            isRegister: true,
            isBlocked: false,
            isVerified: true,
          },
        },
        {
          $lookup: {
            from: "departments",
            localField: "department",
            foreignField: "name",
            as: "doctorData",
          },
        },
      ]);
      console.log(data,"-------------data 210");
    } else {
      data = await Doctor.aggregate([
        {
          $match: {
            isRegister: true,
            isBlocked: false,
            isVerified: true,
            name: { $regex: new RegExp(`^${searchKey}`, "i") },
          },
        },
        {
          $lookup: {
            from: "departments",
            localField: "department",
            foreignField: "name",
            as: "doctorData",
          },
        },
      ]);
      console.log(data,"++++++++++++++++230");
    }
    // const data = await Doctor.find({ name: { $regex: new RegExp(`^${searchKey}`, 'i') } });
    res.json(data);
    console.log(data,"data----------------232");
  } catch (error) {
    console.log(error);
  }
};




const setProfilee = async (req, res) => {
  try {
    const { name, age, address, contact, gender, _id, image } = req.body;
    const uploadedImage = await cloudinary.v2.uploader.upload(image);
    const updatedData = await User.findOneAndUpdate(
      { _id: _id },
      {
        $set: {
          userName: name,
          age: age,
          address: address,
          contact: contact,
          gender: gender,
          image: uploadedImage.url,
        },
      },
      { new: true }
    );

    if (!updatedData) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(updatedData, "updatedData");
    res.status(200).json(updatedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};



const department = async (req, res) => {
  try {
    const dep = await Department.find();
    res.json(dep);
  } catch (error) {
    res.json("error");
  }
};



const docSchedule = async (req, res) => {
  console.log("docSchedule----------",257);
  try {
    const docId=req.params.docId;
    console.log(docId,261);
    const data = await Schedule.find({ doctor: docId }, { _id: 0, doctor: 0 });

    const appoint = await Appointment.find(
      { doctor: docId },
      { date: 1, time: 1 }
    );

    const availableSlots = data.reduce((result, dataItem) => {
      const { date, time } = dataItem;

      const existingSlot = result.find((slot) => slot.date === date);
      const appointTimes = appoint
        .filter((appointItem) => appointItem.date === date)
        .map((appointItem) => appointItem.time);

      if (!existingSlot) {
        result.push({
          date,
          time: time.filter((slot) => !appointTimes.includes(slot)),
        });
      } else {
        existingSlot.time = existingSlot.time.filter(
          (slot) => !appointTimes.includes(slot)
        );
      }

      return result;
    }, []);

    const slot = availableSlots.filter(async (el) => {
      if (new Date(el.date) < new Date()) {
        await Schedule.deleteOne({ date: el.date });
      }
      return new Date(el.date) >= new Date();
    });
    res.json(slot);
  } catch (error) {
console.log(error);
  }
}




const stripeSession = async (req, res, next) => {
  const { doctor, user, slot, doctorName,fee} = req.body;
  console.log(req.body,"body",312);
  const existAppointment = await Appointment.findOne({ slot: slot });
  if (existAppointment)
    return next(createError(409, " Appointment already exist"));
  const customer = await stripe.customers.create({
    metadata: {
      userId: user._id,
      doctorId: doctor._id,
      slot: slot,
    },
  });
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "inr",
          product_data: {
            name: `Dr.${doctorName}`,
          },
          unit_amount: `${fee * 100}`,
        },
        quantity: 1,
      },
    ],
    customer: customer.id,
    mode: "payment",
    success_url: `${process.env.CLIENT_URL}sucess`,
    cancel_url: `${process.env.CLIENT_URL}`,
  });

  res.send({ url: session.url });
};


 const webhooks = async (req, res) => {
  console.log("webhooks--------------347");
  let signInSecret = `${process.env.STRIPE_WEBHOOK_KEY}`;
  const payload = req.body;

  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, signInSecret);
    console.log(event,"event");
  } catch (error) {
    console.log(error)
    res.status(400).json({ success: true });
    return;
  }

  if (event.type === "payment_intent.succeeded") {
    console.log("payment_intent.succeeded------------------362");
    stripe.customers.retrieve(event.data.object.customer).then((customer) => {
      confirmAppointment(customer.metadata, event.data.object, req, res);
    });
  }

  // res.end();
};


const confirmAppointment = async (metadata, paymentdata, req, res) => {
  console.log("confirmAppointment---------373");
  const { doctorId, slot, userId } = metadata;
  console.log(metadata,"metadata----------375");

  try {
    // const existAppointment = await Appointment.findOne({ slot: slot });

    // if (existAppointment) return res.status(409).send("already exist");
    const appointment = new Appointment({
      userId,
      doctorId,
      slot,
      appointment_id: Math.floor(Math.random() * 1000000 + 1),
      payment_mode: paymentdata.payment_method_types,
      payment_status: paymentdata.status,
      amount_paid: paymentdata.amount_received / 100,
    });
    appointment.save();
    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { $push: { bookedSlots: slot }, $pull: { availableSlots: slot } },
      { new: true }
    );

    res.status(201).json({ appointment });
  } catch (error) {
    res.status(500).send("something wrong");
  }
};















const forgotPassword = async (req, res) => {
  console.log("forgotPassword");
  try {
    const email = req.params.email;
    const emailData = await User.find({ email: email });

    console.log(emailData, "emailData====",);
    if (emailData) {
      const otp = Math.floor(1000 + Math.random() * 9000);
      console.log(otp,"otp+++++++++++++++++++++++++++");
      const mailupdated= await User.updateOne({email:email},{$set:{otp:otp}})
      await mailSender(email,otp,"forgotpassword")
      console.log(email,"=======emailData.email");

      console.log(mailupdated,"mailupdated----------");
      res.status(200).json("success");
    }else{
      res.status(404).json("Not Found")
    }
  } catch (error) {
    res.status(500).json({ error: " " });
  }
};

const resetPassword=async(req,res)=>{
 try {
  const {email,password}=req.body
  console.log(email,"-----",password,"email,password");
  await User.findByIdAndUpdate({email:email},{$set:{password:password}}).then(
    res.status(200).json("success"))
    
 } catch (error) {
  res.status(500).json({ error: " " });
}
}

module.exports = {
  signup,
  verifyOtp,
  login,
  userData,
  findDoctors,
  searchDoc,
  docSchedule,
  setProfilee,
  department,

  stripeSession,
  webhooks,

  forgotPassword,
  resetPassword,
  
};
