// First do -> npm install nodemailer, npm install express


const nodemailer = require("nodemailer");
const express = require("express");

const app = express();
app.use(express.json());


app.post("/mailer", async (req,res) => {
    const sender = req.body.sender;
    const receiver = req.body.receiver;
    const sender_apass = req.body.sender_apass;
    const img_path = req.body.img_path;

    if(/[<>]/.test(sender) || /[<>]/.test(receiver) || /[<>]/.test(sender_apass) || /[<>]/.test(img_path))
    {
        return res.status(400).json({ success: false, error: "Invalid char sequence" });
    }
    else{
        const trans = nodemailer.createTransport(
        {
            service: "gmail",
            auth: {
                user: sender,
                pass: sender_apass // go to acc 3rd party services and create a 3rd party (aka app) pass
            }
        }
        );

        const mailBody = {
            from: sender,
            to: receiver,
            subject: "", //create a generalized subject
            text: "i.e. mail's body", //create a generalized body
            attachments: [{
                filename: "steged_img ",
                path: img_path,
                cid: "" //user random to assign a random identifier, its one time use only
            }],
        // any html tag u want to show u can do here
        }

        trans.sendMail(mailBody, (err, info) => {
            if(err){return res.status(500).json({ success: false, error: err.message });}
            
            else{
                console.log("done, sent the mail, check ur email", info.response);
                res.send({success:true});
            }
            
        });
    }
})

