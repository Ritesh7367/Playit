import  {asyncHandler} from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessTokenAndRefreshToken=async(userid)=>{
    try {
        const user=await User.findById(userid)
        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshToken()

        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})

        return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(400,"something went wrong while generating access token")
    }
}

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
    // console.log("email",email);

    //check validation not empty
    if([fullname,email,username,password].some((field)=>field?.trim()==="")){
        throw new ApiError(400,"All fields are required");
    }

    //check user already exist-username,email
    const existeduser=await User.findOne(
        {
            $or:[{email},{username}]
        }
    )
    if (existeduser) {
        throw new ApiError(409,"user already exists")
    }

    //check for image and avtar
    const avtarLocalPath=req.files?.avtar?.[0]?.path;
    const coverImageLocalPath=req.files?.coverImage?.[0]?.path;
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
                    coverimage:coverImage?.url||"",
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

const loginUser=asyncHandler(async (req,res)=>{
    //req.body->data
    //username or email
    //find the user
    //check pasword
    //accesstoken and refreshtoken
    //send cookie

    //req.body->data
    const {email,username,password}=req.body

    //username or email
    if(!(username || password)){
        throw new ApiError(400,"username or email required")
    }
    const user=await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"user does not exist")
    }

    const isPasswordvalid=await user.isPasswordCorrect(password)

    if (!isPasswordvalid) {
        throw new ApiError(404,"password incorrect")
    }
    const {accessToken,refreshToken}=await generateAccessTokenAndRefreshToken(user._id)

    const loggedInUser=await User.findById(user._id).select("-password -refreshToken")

    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{
            user:loggedInUser,accessToken,refreshToken
        },"user loggin successfully")
    )

})

const logoutUser=asyncHandler(async(req,res)=>{
      await User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                refreshToken:undefined
                }
            },
            {
                new:true
            }
        )

        const options={
        httpOnly:true,
        secure:true
        }

        return res.status(200).clearCookie("accessToken",options).clearCookie("refreshToken",options)
        .json(new ApiResponse(200,{},"user logged out"))
})


export {registerUser,loginUser,logoutUser};