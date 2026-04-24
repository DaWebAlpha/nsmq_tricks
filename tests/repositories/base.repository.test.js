import { jest, describe, test, expect, beforeEach } from "@jest/globals";

class MockAppError extends Error {
    constructor(message = "Application Error", statusCode = 500, details = null) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
    }
}

await jest.unstable_mockModule("../../backend/src/errors/app.error.js", () => ({
    AppError: MockAppError,
}));

const { BaseRepository } = await import(
    "../../backend/src/repositories/base.repository.js"
);

const createChainableQuery = (resolvedValue) => {
    const query = {
        session: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        setOptions: jest.fn().mockReturnThis(),
        then: (resolve, reject) => Promise.resolve(resolvedValue).then(resolve, reject),
        catch: (reject) => Promise.resolve(resolvedValue).catch(reject),
    };

    return query;
};

const createMockModel = () => {
    const model = function MockModel() {};
    model.modelName = "TestModel";
    model.create = jest.fn();
    model.insertMany = jest.fn();
    model.findById = jest.fn();
    model.findOne = jest.fn();
    model.find = jest.fn();
    model.countDocuments = jest.fn();
    model.findByIdAndUpdate = jest.fn();
    model.findByIdAndDelete = jest.fn();
    model.deleteMany = jest.fn();
    model.exists = jest.fn();
    return model;
};

describe("BaseRepository", () => {
    let model;
    let repository;

    beforeEach(() => {
        model = createMockModel();
        repository = new BaseRepository(model);
    });

    test("constructor should throw when model is invalid", () => {
        expect(() => new BaseRepository()).toThrow("A valid Mongoose model is required");
        expect(() => new BaseRepository({})).toThrow("A valid Mongoose model is required");
        expect(() => new BaseRepository({ modelName: "BrokenModel" })).toThrow(
            "A valid Mongoose model is required"
        );
    });

    test("_transformLean should add id and remove version keys", () => {
        const result = repository._transformLean({
            _id: "abc123",
            name: "Kashi",
            __v: 1,
            __version: 2,
        });

        expect(result).toEqual({
            _id: "abc123",
            id: "abc123",
            name: "Kashi",
        });
    });

    test("_transformLean should handle arrays", () => {
        const result = repository._transformLean([
            { _id: "1", __v: 0 },
            { _id: "2", __version: 3 },
        ]);

        expect(result).toEqual([
            { _id: "1", id: "1" },
            { _id: "2", id: "2" },
        ]);
    });

    test("_normalizeDoc should use toObject when available", () => {
        const doc = {
            toObject: jest.fn().mockReturnValue({ id: "1", name: "User" }),
        };

        const result = repository._normalizeDoc(doc);

        expect(doc.toObject).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ id: "1", name: "User" });
    });

    test("create should create and normalize document", async () => {
        const doc = {
            toObject: jest.fn().mockReturnValue({ id: "1", name: "User" }),
        };

        model.create.mockResolvedValue([doc]);

        const result = await repository.create({ name: "User" }, { session: "s1" });

        expect(model.create).toHaveBeenCalledWith([{ name: "User" }], { session: "s1" });
        expect(result).toEqual({ id: "1", name: "User" });
    });

    test("insertMany should normalize returned documents", async () => {
        const docs = [
            { toObject: jest.fn().mockReturnValue({ id: "1" }) },
            { toObject: jest.fn().mockReturnValue({ id: "2" }) },
        ];

        model.insertMany.mockResolvedValue(docs);

        const result = await repository.insertMany([{ a: 1 }]);

        expect(result).toEqual([{ id: "1" }, { id: "2" }]);
    });

    test("findById should apply lean by default and normalize result", async () => {
        const query = createChainableQuery({ _id: "abc", __v: 0, name: "Doc" });
        model.findById.mockReturnValue(query);

        const result = await repository.findById("abc", {
            session: "s1",
            populate: "owner",
            select: "name",
        });

        expect(model.findById).toHaveBeenCalledWith("abc");
        expect(query.session).toHaveBeenCalledWith("s1");
        expect(query.populate).toHaveBeenCalledWith("owner");
        expect(query.select).toHaveBeenCalledWith("name");
        expect(query.lean).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            _id: "abc",
            id: "abc",
            name: "Doc",
        });
    });

    test("findById should not lean when lean is false", async () => {
        const doc = {
            toObject: jest.fn().mockReturnValue({ id: "abc", name: "Doc" }),
        };
        const query = createChainableQuery(doc);
        model.findById.mockReturnValue(query);

        const result = await repository.findById("abc", { lean: false });

        expect(query.lean).not.toHaveBeenCalled();
        expect(result).toEqual({ id: "abc", name: "Doc" });
    });

    test("findById should throw AppError when doc is not found", async () => {
        const query = createChainableQuery(null);
        model.findById.mockReturnValue(query);

        await expect(repository.findById("missing")).rejects.toMatchObject({
            name: "AppError",
            statusCode: 404,
            message: "TestModel with id missing not found",
        });
    });

    test("findOne should throw AppError when doc is not found", async () => {
        const query = createChainableQuery(null);
        model.findOne.mockReturnValue(query);

        await expect(
            repository.findOne({ email: "x@example.com" })
        ).rejects.toMatchObject({
            name: "AppError",
            statusCode: 404,
            message: "TestModel not found",
        });
    });

    test("findAll should apply pagination and return metadata", async () => {
        const findQuery = createChainableQuery([{ _id: "1", __v: 0, name: "A" }]);
        const countQuery = createChainableQuery(45);

        model.find.mockReturnValue(findQuery);
        model.countDocuments.mockReturnValue(countQuery);

        const result = await repository.findAll(
            { active: true },
            {
                page: 2,
                limit: 10,
                sort: { createdAt: -1 },
                select: "name",
                populate: "owner",
                lean: true,
                session: "s1",
            }
        );

        expect(model.find).toHaveBeenCalledWith({ active: true });
        expect(findQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(findQuery.select).toHaveBeenCalledWith("name");
        expect(findQuery.populate).toHaveBeenCalledWith("owner");
        expect(findQuery.skip).toHaveBeenCalledWith(10);
        expect(findQuery.limit).toHaveBeenCalledWith(10);
        expect(findQuery.lean).toHaveBeenCalledTimes(1);
        expect(findQuery.session).toHaveBeenCalledWith("s1");
        expect(countQuery.session).toHaveBeenCalledWith("s1");

        expect(result).toEqual({
            docs: [{ _id: "1", id: "1", name: "A" }],
            total: 45,
            page: 2,
            limit: 10,
            totalPages: 5,
        });
    });

    test("findAll should cap limit at 100", async () => {
        const findQuery = createChainableQuery([]);
        const countQuery = createChainableQuery(0);

        model.find.mockReturnValue(findQuery);
        model.countDocuments.mockReturnValue(countQuery);

        const result = await repository.findAll({}, { limit: 500 });

        expect(findQuery.limit).toHaveBeenCalledWith(100);
        expect(result.limit).toBe(100);
    });

    test("updateById should update and normalize document", async () => {
        const query = createChainableQuery({
            toObject: jest.fn().mockReturnValue({ id: "1", name: "Updated" }),
        });

        model.findByIdAndUpdate.mockReturnValue(query);

        const result = await repository.updateById(
            "1",
            { name: "Updated" },
            { session: "s1", populate: "owner", select: "name", upsert: false }
        );

        expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
            "1",
            { $set: { name: "Updated" } },
            expect.objectContaining({
                new: true,
                runValidators: true,
                session: "s1",
                upsert: false,
            })
        );

        expect(query.populate).toHaveBeenCalledWith("owner");
        expect(query.select).toHaveBeenCalledWith("name");
        expect(result).toEqual({ id: "1", name: "Updated" });
    });

    test("updateById should support lean responses", async () => {
        const query = createChainableQuery({ _id: "1", __v: 0, name: "Updated" });
        model.findByIdAndUpdate.mockReturnValue(query);

        const result = await repository.updateById("1", { name: "Updated" }, { lean: true });

        expect(query.lean).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            _id: "1",
            id: "1",
            name: "Updated",
        });
    });

    test("updateById should throw AppError when doc is not found", async () => {
        const query = createChainableQuery(null);
        model.findByIdAndUpdate.mockReturnValue(query);

        await expect(
            repository.updateById("404", { name: "Missing" })
        ).rejects.toMatchObject({
            name: "AppError",
            statusCode: 404,
            message: "TestModel with id 404 not found",
        });
    });

    test("deleteById should remove and normalize document", async () => {
        model.findByIdAndDelete.mockResolvedValue({
            toObject: jest.fn().mockReturnValue({ id: "1", deleted: true }),
        });

        const result = await repository.deleteById("1");

        expect(model.findByIdAndDelete).toHaveBeenCalledWith("1", {});
        expect(result).toEqual({ id: "1", deleted: true });
    });

    test("deleteById should throw AppError when doc is not found", async () => {
        model.findByIdAndDelete.mockResolvedValue(null);

        await expect(repository.deleteById("404")).rejects.toMatchObject({
            name: "AppError",
            statusCode: 404,
            message: "TestModel with id 404 not found",
        });
    });

    test("deleteAll should forward to model.deleteMany", async () => {
        model.deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 3 });

        const result = await repository.deleteAll({ active: false }, { session: "s1" });

        expect(model.deleteMany).toHaveBeenCalledWith({ active: false }, { session: "s1" });
        expect(result).toEqual({ acknowledged: true, deletedCount: 3 });
    });

    test("exists should forward session to query", async () => {
        const query = createChainableQuery({ _id: "1" });
        model.exists.mockReturnValue(query);

        const result = repository.exists({ email: "a@example.com" }, { session: "s1" });

        expect(model.exists).toHaveBeenCalledWith({ email: "a@example.com" });
        expect(query.session).toHaveBeenCalledWith("s1");
        await expect(result).resolves.toEqual({ _id: "1" });
    });

    test("count should forward session to query", async () => {
        const query = createChainableQuery(7);
        model.countDocuments.mockReturnValue(query);

        const result = repository.count({ active: true }, { session: "s1" });

        expect(model.countDocuments).toHaveBeenCalledWith({ active: true });
        expect(query.session).toHaveBeenCalledWith("s1");
        await expect(result).resolves.toBe(7);
    });

    test("hardDelete should call document hardDelete", async () => {
        const doc = {
            hardDelete: jest.fn().mockResolvedValue({ acknowledged: true }),
        };

        const query = createChainableQuery(doc);
        model.findOne.mockReturnValue(query);

        const result = await repository.hardDelete("1", { session: "s1" });

        expect(model.findOne).toHaveBeenCalledWith({ _id: "1" });
        expect(query.setOptions).toHaveBeenCalledWith({ skipFilter: true });
        expect(query.session).toHaveBeenCalledWith("s1");
        expect(doc.hardDelete).toHaveBeenCalledWith({ session: "s1" });
        expect(result).toEqual({ acknowledged: true });
    });

    test("softDeleteById should call document softDelete and normalize result", async () => {
        const softDeletedDoc = {
            toObject: jest.fn().mockReturnValue({ id: "1", isDeleted: true }),
        };

        const doc = {
            softDelete: jest.fn().mockResolvedValue(softDeletedDoc),
        };

        const query = createChainableQuery(doc);
        model.findOne.mockReturnValue(query);

        const result = await repository.softDeleteById("1");

        expect(doc.softDelete).toHaveBeenCalledWith({});
        expect(result).toEqual({ id: "1", isDeleted: true });
    });

    test("restoreSoftDeleteById should call document restoreDelete and normalize result", async () => {
        const restoredDoc = {
            toObject: jest.fn().mockReturnValue({ id: "1", isDeleted: false }),
        };

        const doc = {
            restoreDelete: jest.fn().mockResolvedValue(restoredDoc),
        };

        const query = createChainableQuery(doc);
        model.findOne.mockReturnValue(query);

        const result = await repository.restoreSoftDeleteById("1", { session: "s1" });

        expect(model.findOne).toHaveBeenCalledWith({ _id: "1", isDeleted: true });
        expect(query.session).toHaveBeenCalledWith("s1");
        expect(doc.restoreDelete).toHaveBeenCalledWith({ session: "s1" });
        expect(result).toEqual({ id: "1", isDeleted: false });
    });

    test("softDeleteById should throw clear error when softDelete method is missing", async () => {
        const query = createChainableQuery({});
        model.findOne.mockReturnValue(query);

        await expect(repository.softDeleteById("1")).rejects.toThrow(
            "TestModel document does not implement softDelete()"
        );
    });

    test("restoreSoftDeleteById should throw AppError when doc is not found", async () => {
        const query = createChainableQuery(null);
        model.findOne.mockReturnValue(query);

        await expect(repository.restoreSoftDeleteById("1")).rejects.toMatchObject({
            name: "AppError",
            statusCode: 404,
            message: "TestModel with id 1 not found",
        });
    });
});