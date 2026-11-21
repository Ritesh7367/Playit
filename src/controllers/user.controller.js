import  {asyncHandler} from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser=asyncHandler (async (req,res)=>{
    //get data from frontend
    //check validation not empty
    //check user already exist-username,email
    //check for image and avtar
    //upload them on cloudnary
    //create user object-create entry in db
    //remove password and refresh token field from response
    //check for user creation 
    //return res

    //get data from frontend
    const {fullname,email,username,password} =req.body
    console.log("email",email);

    //check validation not empty
    if([fullname,email,username,password].some((field)=>field?.trim()==="")){
        throw new ApiError(400,"All fields are required");
    }

    //check user already exist-username,email
    const existeduser=User.findOne(
        {
            $or:[{email},{username}]
        }
    )
    if (existeduser) {
        throw new ApiError(409,"user already exists")
    }

    //check for image and avtar
    const avtarLocalPath=req.files?.avtar[0]?.path;
    const coverImageLocalPath=req.files?.coverImage[0]?.path;
    if (!avtarLocalPath) {
        throw new ApiError(400,"avtar is required")
    }

    //upload them on cloudnary
    const avtar=await uploadOnCloudinary(avtarLocalPath)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!avtar){
        throw new ApiError(400,"avtar is required")
    }

    //create user object-create entry in db

    const user=await User.create({
                    fullname,
                    avtar:avtar.url,
                    coverImage:coverImage?.url||"",
                    email,
                    password,
                    username:username.toLowerCase()
                })

    //remove password and refresh token field from response

    const createdUser=await User.findById(user._id).select("-password -refreshToken")   
    
    if(!createdUser){
        throw new ApiError(500,"something went wrong while registering")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"user registered")
    )
})


export {registerUser};