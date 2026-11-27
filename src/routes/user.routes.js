import { Router } from "express";
import { registerUser,loginUser,logoutUser,refreshAccessToken,changePassword,getCurrentUser,updateUserProfile,updateUserAvtar,updateUserCoverImage,getUserChannelProfile,getWatchHistory} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router=Router()

router.route("/register").post(upload.fields([
    {
    name:"avtar",
      maxCount:1
    },
    {
       name:"coverImage",
       maxCount:1
    }
]),registerUser)

router.route("/login").post(loginUser)

//secured routes

router.route("/logout").post(verifyJWT,logoutUser)
router.route("/refreshtoken").post(refreshAccessToken)
router.route("/changepassword").post(verifyJWT,changePassword)
router.route("/me").get(verifyJWT,getCurrentUser)
router.route("/updateprofile").patch(verifyJWT,updateUserProfile)
router.route("/updateavtar").patch(verifyJWT,upload.single("avtar"),updateUserAvtar)
router.route("/updatecoverimage").patch(verifyJWT,upload.single("coverImage"),updateUserCoverImage)
router.route("/channel/:username").get(verifyJWT,getUserChannelProfile)
router.route("/history").get(verifyJWT,getWatchHistory)


export default router