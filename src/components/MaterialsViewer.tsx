import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNotification } from "../contexts/NotificationContext";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Material } from "../interfaces/Material";
import { Module } from "../interfaces/Module";

// Props for the MaterialsViewer component
interface MaterialsViewerProps {
  role: "student" | "lecturer"; // The role of the current user
  courseId?: string; // Optional courseId to filter modules (for students)
}

export default function MaterialsViewer({
  role,
  courseId,
}: MaterialsViewerProps) {
  const { userData, currentUser } = useAuth();
  const { showNotification } = useNotification();

  // State initialization with proper initial values
  const [modules, setModules] = useState<Module[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [viewingCourseId, setViewingCourseId] = useState<string | undefined>(
    courseId || localStorage.getItem("viewingCourseId") || undefined
  );

  // Test function to check what modules exist in Firestore
  const testQueryAllModules = async () => {
    try {
      console.log("DEBUG: TESTING - Direct query of all modules in Firestore");
      const modulesCollection = collection(db, "modules");
      const snapshot = await getDocs(modulesCollection);

      const allModules = snapshot.docs.map((doc) => {
        const data = doc.data();
        const module: Module = {
          id: doc.id,
          title: data.title || "",
          description: data.description || "",
          duration: data.duration || 0,
          credits: data.credits || 0,
          courseId: data.courseId || "",
          prerequisites: data.prerequisites || [],
          learningOutcomes: data.learningOutcomes || [],
          assessmentMethods: data.assessmentMethods || [],
          createdAt: data.createdAt
            ? new Date(data.createdAt.seconds * 1000)
            : new Date(),
          updatedAt: data.updatedAt
            ? new Date(data.updatedAt.seconds * 1000)
            : new Date(),
        };
        return module;
      });

      console.log("DEBUG: TESTING - All modules query results:", {
        empty: snapshot.empty,
        size: snapshot.size,
        docs: allModules,
      });

      // Log each module's complete data for debugging
      console.log("DEBUG: TESTING - Complete module data:");
      allModules.forEach((module) => {
        console.log(`Module ${module.id}:`, module);
      });

      if (viewingCourseId) {
        console.log(
          `DEBUG: TESTING - Looking for modules with courseId = "${viewingCourseId}"`
        );
        const matchingModules = allModules.filter(
          (module) => module.courseId === viewingCourseId
        );
        console.log(
          `DEBUG: TESTING - Found ${matchingModules.length} matching modules:`,
          matchingModules
        );
      }
    } catch (error) {
      console.error("DEBUG: TESTING - Error querying all modules:", error);
    }
  };

  // Test function to check what materials exist in Firestore
  const testQueryAllMaterials = async () => {
    try {
      console.log(
        "DEBUG: TESTING - Direct query of all materials in Firestore"
      );
      const materialsCollection = collection(db, "materials");
      const snapshot = await getDocs(materialsCollection);

      const allMaterials = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      console.log("DEBUG: TESTING - All materials query results:", {
        empty: snapshot.empty,
        size: snapshot.size,
        docs: allMaterials,
      });
    } catch (error) {
      console.error("DEBUG: TESTING - Error querying all materials:", error);
    }
  };

  // Test function to check enrolled courses for current student
  const testQueryEnrolledCourses = async () => {
    try {
      console.log("DEBUG: TESTING - Current user data:", userData);

      if (!currentUser?.uid) {
        console.log("DEBUG: TESTING - No current user UID available");
        return;
      }

      console.log(
        "DEBUG: TESTING - Querying enrollments for student:",
        currentUser.uid
      );
      const enrollmentsCollection = collection(db, "enrollments");
      const enrollmentsQuery = query(
        enrollmentsCollection,
        where("studentId", "==", currentUser.uid)
      );
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);

      console.log("DEBUG: TESTING - Student enrollments:", {
        empty: enrollmentsSnapshot.empty,
        size: enrollmentsSnapshot.size,
        enrollments: enrollmentsSnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })),
      });

      // Now check each course
      if (!enrollmentsSnapshot.empty) {
        await checkModulesForEnrollments(enrollmentsSnapshot);
      }
    } catch (error) {
      console.error("DEBUG: TESTING - Error querying enrollments:", error);
    }
  };

  // Helper function to check modules for enrollments
  const checkModulesForEnrollments = async (enrollmentsSnapshot: any) => {
    for (const enrollDoc of enrollmentsSnapshot.docs) {
      const enrollData = enrollDoc.data();
      console.log(
        `DEBUG: TESTING - Checking modules for course: ${enrollData.courseId}`
      );

      const modulesRef = collection(db, "modules");
      const moduleSnapshot = await getDocs(modulesRef);

      // Map and filter modules
      const matchingModules = moduleSnapshot.docs
        .map((doc) => {
          const data = doc.data();
          const module: Module = {
            id: doc.id,
            title: data.title || "",
            description: data.description || "",
            duration: data.duration || 0,
            credits: data.credits || 0,
            courseId: data.courseId || "",
            prerequisites: data.prerequisites || [],
            learningOutcomes: data.learningOutcomes || [],
            assessmentMethods: data.assessmentMethods || [],
            createdAt: data.createdAt
              ? new Date(data.createdAt.seconds * 1000)
              : new Date(),
            updatedAt: data.updatedAt
              ? new Date(data.updatedAt.seconds * 1000)
              : new Date(),
          };
          return module;
        })
        .filter((module) => module.courseId === enrollData.courseId);

      console.log(
        `DEBUG: TESTING - Modules for course ${enrollData.courseId}:`,
        {
          total: moduleSnapshot.size,
          matching: matchingModules.length,
          modules: matchingModules,
        }
      );
    }
  };

  // Run test queries on component mount
  useEffect(() => {
    testQueryAllModules();
    testQueryAllMaterials();
    testQueryEnrolledCourses();
  }, [currentUser]); // Changed dependency to currentUser

  // Update viewingCourseId when props or localStorage changes
  useEffect(() => {
    const newCourseId = courseId || localStorage.getItem("viewingCourseId");
    console.log("DEBUG: Updating viewingCourseId:", {
      courseId,
      storedCourseId: localStorage.getItem("viewingCourseId"),
      newCourseId,
      currentViewingCourseId: viewingCourseId,
    });

    if (newCourseId && newCourseId !== viewingCourseId) {
      console.log("DEBUG: Setting new viewingCourseId:", newCourseId);
      setViewingCourseId(newCourseId);
    }
  }, [courseId]);

  // Load modules when viewingCourseId changes
  useEffect(() => {
    console.log("DEBUG: viewingCourseId effect triggered:", viewingCourseId);
    if (viewingCourseId) {
      fetchModules();
    }
  }, [viewingCourseId]);

  // Load materials when selected module changes
  useEffect(() => {
    if (selectedModule) {
      fetchMaterials(selectedModule);
    } else {
      setMaterials([]);
    }
  }, [selectedModule]);

  // Function to fetch modules from Firestore
  const fetchModules = async () => {
    try {
      setLoading(true);
      console.log("DEBUG: fetchModules starting with:", {
        role,
        viewingCourseId,
        userData,
      });

      // Query all modules
      const modulesRef = collection(db, "modules");
      const modulesSnapshot = await getDocs(modulesRef);

      // Process all modules from Firestore
      const allModules = modulesSnapshot.docs.map((doc) => {
        const data = doc.data();
        const module: Module = {
          id: doc.id,
          title: data.title || "",
          description: data.description || "",
          duration: data.duration || 0,
          credits: data.credits || 0,
          courseId: data.courseId || "",
          prerequisites: data.prerequisites || [],
          learningOutcomes: data.learningOutcomes || [],
          assessmentMethods: data.assessmentMethods || [],
          createdAt: data.createdAt
            ? new Date(data.createdAt.seconds * 1000)
            : new Date(),
          updatedAt: data.updatedAt
            ? new Date(data.updatedAt.seconds * 1000)
            : new Date(),
        };
        return module;
      });

      console.log("DEBUG: All modules:", {
        total: modulesSnapshot.size,
        modules: allModules,
      });

      // For students, we should filter by courseId or by student enrollments
      // For lecturers, we can show all modules
      let modulesToShow = allModules;

      if (role === "student" && viewingCourseId) {
        // Try to filter by courseId, but if none match, show all modules
        const filteredModules = allModules.filter(
          (module) => module.courseId === viewingCourseId
        );

        console.log("DEBUG: Filtered modules:", {
          filtered: filteredModules.length,
          modules: filteredModules,
        });

        // If we have matching modules, use the filtered list
        if (filteredModules.length > 0) {
          modulesToShow = filteredModules;
        } else {
          console.log("DEBUG: No modules match courseId, showing all modules");
        }
      }

      setModules(modulesToShow);
    } catch (error) {
      console.error("Error fetching modules:", error);
      showNotification("Failed to load modules");
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch materials for a specific module
  const fetchMaterials = async (moduleId: string) => {
    try {
      setLoading(true);
      setMaterials([]);

      const materialsQuery = query(
        collection(db, "materials"),
        where("moduleId", "==", moduleId)
      );
      const materialsSnapshot = await getDocs(materialsQuery);

      if (materialsSnapshot.empty) {
        console.log("No materials found for this module");
        setLoading(false);
        return;
      }

      const materialsList = materialsSnapshot.docs.map((doc) => {
        const data = doc.data();
        // Process timestamps
        const processTimestamp = (timestamp: any) => {
          if (!timestamp) return new Date();
          if (timestamp.toDate && typeof timestamp.toDate === "function") {
            return new Date(timestamp.toDate());
          }
          if (timestamp instanceof Date) return timestamp;
          if (timestamp.seconds) {
            return new Date(timestamp.seconds * 1000);
          }
          return new Date();
        };

        // Map Firebase field names to our component's expected field names
        return {
          id: doc.id,
          moduleId: data.moduleId || moduleId,
          title: data.title || data.name || "Untitled",
          description: data.description || "",
          fileUrl: data.fileUrl || "",
          fileName:
            data.fileName || data.name || data.fileUrl || "Unknown file",
          fileType: data.fileType || "application/octet-stream",
          fileSize: data.fileSize || data.size || 0,
          uploadedBy: data.uploadedBy || "",
          createdAt: processTimestamp(data.createdAt || data.uploadedAt),
          updatedAt: processTimestamp(data.updatedAt || data.uploadedAt),
        };
      }) as Material[];

      setMaterials(materialsList);
    } catch (error) {
      console.error("Error fetching materials:", error);
      showNotification("Failed to load materials");
    } finally {
      setLoading(false);
    }
  };

  // Function to get file size in a readable format
  const formatFileSize = (bytes: number) => {
    if (!bytes || isNaN(bytes) || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Function to get file icon based on file type
  const getFileIcon = (fileType: string = "") => {
    if (!fileType) return "bi bi-file-earmark-text";

    if (fileType.includes("pdf")) {
      return "bi bi-file-earmark-pdf";
    } else if (fileType.includes("word") || fileType.includes("doc")) {
      return "bi bi-file-earmark-word";
    } else if (
      fileType.includes("excel") ||
      fileType.includes("sheet") ||
      fileType.includes("csv")
    ) {
      return "bi bi-file-earmark-excel";
    } else if (
      fileType.includes("presentation") ||
      fileType.includes("powerpoint")
    ) {
      return "bi bi-file-earmark-slides";
    } else if (fileType.includes("image")) {
      return "bi bi-file-earmark-image";
    } else if (fileType.includes("video")) {
      return "bi bi-file-earmark-play";
    } else if (fileType.includes("audio")) {
      return "bi bi-file-earmark-music";
    } else if (
      fileType.includes("zip") ||
      fileType.includes("rar") ||
      fileType.includes("tar")
    ) {
      return "bi bi-file-earmark-zip";
    } else {
      return "bi bi-file-earmark-text";
    }
  };

  // Function to update modules with courseId
  const updateModulesWithCourseId = async () => {
    try {
      console.log("DEBUG: Starting module updates...");
      const modulesRef = collection(db, "modules");
      const modulesSnapshot = await getDocs(modulesRef);

      // Update each module
      const updatePromises = modulesSnapshot.docs.map(async (docSnapshot) => {
        const moduleData = docSnapshot.data();
        const moduleRef = doc(db, "modules", docSnapshot.id);

        // Only update if courseId is not set
        if (!moduleData.courseId) {
          console.log(
            `DEBUG: Updating module ${docSnapshot.id} with courseId ${viewingCourseId}`
          );
          return updateDoc(moduleRef, {
            courseId: viewingCourseId,
          });
        }
        return Promise.resolve();
      });

      await Promise.all(updatePromises);
      console.log("DEBUG: All modules updated successfully");

      // Refresh the modules list
      fetchModules();
    } catch (error) {
      console.error("Error updating modules:", error);
      showNotification("Failed to update modules");
    }
  };

  // Add button to trigger update in the UI
  const renderUpdateButton = () => {
    if (role === "lecturer") {
      return (
        <button
          className="btn btn-warning btn-sm ms-2"
          onClick={updateModulesWithCourseId}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          Update Module Assignments
        </button>
      );
    }
    return null;
  };

  return (
    <div className="container-fluid">
      <div className="row mb-4">
        <div className="col-md-12">
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  <i className="bi bi-file-earmark-text me-2"></i>
                  Course Materials
                </h5>
                {renderUpdateButton()}
              </div>
              <p className="text-muted mt-2">
                View and download educational materials for your modules.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-4 mb-4">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Select Module</h6>
            </div>
            <div className="card-body">
              {loading && modules.length === 0 ? (
                <div className="d-flex justify-content-center">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                <select
                  className="form-select"
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                >
                  <option value="">Select a module</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Materials List</h6>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="d-flex justify-content-center">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : !selectedModule ? (
                <div className="text-center py-5">
                  <i className="bi bi-arrow-left-circle fs-1 text-muted"></i>
                  <p className="mt-3">Select a module to view its materials</p>
                </div>
              ) : materials.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-file-earmark-x fs-1 text-muted"></i>
                  <p className="mt-3">No materials found for this module</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>File Type</th>
                        <th>Size</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((material) => (
                        <tr key={material.id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <i
                                className={`${getFileIcon(
                                  material.fileType
                                )} fs-4 me-2`}
                              ></i>
                              <div>
                                <div className="fw-medium">
                                  {material.title}
                                </div>
                                {material.description && (
                                  <small className="text-muted">
                                    {material.description}
                                  </small>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            {material.fileType
                              ? material.fileType
                                  .split("/")
                                  .pop()
                                  ?.toUpperCase()
                              : "Unknown"}
                          </td>
                          <td>{formatFileSize(material.fileSize)}</td>
                          <td>
                            <a
                              href={material.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-outline-primary"
                              title="Download"
                            >
                              <i className="bi bi-download"></i> Download
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
