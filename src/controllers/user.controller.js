import  {asyncHandler} from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

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
    if(!(username || email)|| !password){
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
                $unset:{
                refreshToken:1
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

const refreshAccessToken=asyncHandler(async (req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(400,"unauthorized request")
    }

    try {
        const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user=await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401,"invalid refresh token")
        }
    
        if(incomingRefreshToken!==user?.refreshToken){
            throw new ApiError(401,"refresh token expired or used")
        }
        const options={
            httpOnly:true,
            secure:true
        }
        const {accessToken,newRefreshToken}=await generateAccessTokenAndRefreshToken(user._id)
    
        return res.status(200)
        .cookie("accessToken",accessToken)
        .cookie("refreshToken",newRefreshToken)
        .json(new ApiResponse(200,{accessToken,newRefreshToken},"access token refreshed"))
    
    
    } catch (error) {
        throw new ApiError(401,error?.message||"invalid refresh token")
    }
})    

const changePassword=asyncHandler(async (req,res)=>{
    const user=await User.findById(req.user?._id)
    const {oldPassword,newPassword}=req.body

    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"wrong password")
    }

    user.password=newPassword

    await user.save({validateBeforeSave:false})

    return res.status(200).json(new ApiResponse(200,{},"password changed successfully"))
})

const getCurrentUser=asyncHandler(async (req,res)=>{
    return res
    .status(200).
    json(new ApiResponse(200,req.user,"current user fetched successfully"))
})

const updateUserProfile=asyncHandler(async (req,res)=>{
    const {fullname,username,email}=req.body
    if([fullname,email].some((field)=>field?.trim()==="")){
        throw new ApiError(400,"email and fullname fields are required")
    }
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                username,
                email
            }
        },
        {
            new:true
        }
    ).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200,user,"user profile updated successfully"))
})

const updateUserAvtar=asyncHandler(async (req,res)=>{
    const avtarLocalPath=req.file?.path;
    if (!avtarLocalPath) {
        throw new ApiError(400,"avtar is required")
    }
    const avtar=await uploadOnCloudinary(avtarLocalPath)
    if(!avtar.url){
        throw new ApiError(400,"error while uploading avtar")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avtar:avtar.url
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res.status(200).json(new ApiResponse(200,user,"user avtar updated successfully"))
})

const updateUserCoverImage=asyncHandler(async (req,res)=>{
    const coverImageLocalPath=req.file?.path;
    if (!coverImageLocalPath) {
        throw new ApiError(400,"cover image is required")
    }
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400,"error while uploading cover image")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res.status(200).json(new ApiResponse(200,user,"user cover image updated successfully"))
})

const getUserChannelProfile=asyncHandler(async (req,res)=>{
    const {username}=req.params
    if(!username?.trim()){
        throw new ApiError(400,"username is missing")
    }

    const channel=await User.aggregate([
        {
            $match: {
                username: username.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "SubscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },
                subscribedToCount: { $size: "$SubscribedTo" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                avtar: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1,
                email: 1,
                coverImage: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404,"channel not found")
    }

    return res.status(200).json(new ApiResponse(200,channel[0],"channel profile fetched successfully"))
})

const getWatchHistory=asyncHandler(async (req,res)=>{
    const user=await User.aggregate([
        {
            $match: {
                _id:new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                    {
                                        $project: {
                                            fullname: 1,
                                            username: 1,
                                            avtar: 1
                                        }
                                    }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: { $first: "$owner" }
                        }
                    }
                ]

            }
        }
    ])
    return res.status(200).json(new ApiResponse(200,user[0]?.watchHistory||[],"watch history fetched successfully"))
})


export {registerUser,loginUser,logoutUser,refreshAccessToken,changePassword,getCurrentUser,updateUserProfile,updateUserAvtar,updateUserCoverImage,getUserChannelProfile,getWatchHistory};