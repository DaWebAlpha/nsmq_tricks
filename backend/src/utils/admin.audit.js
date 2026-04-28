import {
    getClientIP,
    getUserAgent,
    getDeviceName,
    getDeviceId,
} from "./request.js";

const getAdminAuditMeta = (request) => {
    return {
        ipAddress: getClientIP(request),
        userAgent: getUserAgent(request),
        deviceName: getDeviceName(request),
        deviceId: getDeviceId(request),
    };
};

export { getAdminAuditMeta };
export default getAdminAuditMeta;