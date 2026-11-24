import { db } from '../../db/client.js';
import { AppError } from '../../shared/errors.js';

async function findActiveCategory(categoryId) {
  const category = await db().category.findUnique({ where: { id: categoryId } });
  if (category === null || category.isActive === false) {
    throw new AppError(404, 'Category not found');
  }
  return category;
}

async function findFollow(categoryId, studentId) {
  return db().followedCategory.findUnique({
    where: { categoryId_userId: { categoryId: categoryId, userId: studentId } },
  });
}

export async function followCategory(categoryId, studentId) {
  await findActiveCategory(categoryId);
  const existing = await findFollow(categoryId, studentId);
  if (existing !== null) {
    throw new AppError(409, 'You already follow this category');
  }
  try {
    return await db().followedCategory.create({
      data: { categoryId: categoryId, userId: studentId },
      include: { category: { select: { id: true, name: true } } },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'You already follow this category');
    }
    throw error;
  }
}

export async function unfollowCategory(categoryId, studentId) {
  const existing = await findFollow(categoryId, studentId);
  if (existing === null) {
    throw new AppError(404, 'You do not follow this category');
  }
  await db().followedCategory.delete({ where: { id: existing.id } });
  return { result: 'unfollowed' };
}

export async function listFollowedCategories(studentId) {
  const follows = await db().followedCategory.findMany({
    where: { userId: studentId, category: { isActive: true } },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { category: { name: 'asc' } },
  });
  const categories = [];
  for (const follow of follows) {
    categories.push(follow.category);
  }
  return categories;
}

export async function listCategoriesForStudent(studentId) {
  const categories = await db().category.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const followed = await listFollowedCategories(studentId);
  const followedIds = [];
  for (const category of followed) {
    followedIds.push(category.id);
  }
  const result = [];
  for (const category of categories) {
    result.push({ id: category.id, name: category.name, isFollowed: followedIds.includes(category.id) });
  }
  return result;
}
