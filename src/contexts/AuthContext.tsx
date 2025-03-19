import {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  UserCredential,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../firebase";

// Global variable to ensure admin setup runs only once per app lifecycle
let adminSetupComplete = false;

interface AuthContextProps {
  currentUser: User | null;
  userData: any;
  signup: (
    email: string,
    password: string,
    name: string,
    role: string
  ) => Promise<UserCredential>;
  login: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  loading: boolean;
  sendVerificationEmail: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Function to send verification email
  async function sendVerificationEmail(user: User) {
    return sendEmailVerification(user);
  }

  async function signup(
    email: string,
    password: string,
    name: string,
    role: string
  ) {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Update profile with name
    if (userCredential.user) {
      await updateProfile(userCredential.user, {
        displayName: name,
      });

      // Send verification email
      await sendEmailVerification(userCredential.user);

      // Store additional user data in Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name,
        email,
        role,
        emailVerified: false,
        createdAt: serverTimestamp(),
      });
    }

    return userCredential;
  }

  function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  // Function to check if the admin exists in authentication (by checking sign-in methods)
  async function adminExistsInAuth(email: string) {
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      return methods.length > 0;
    } catch (error) {
      console.error("Error checking if admin exists in auth:", error);
      return false;
    }
  }

  // Function to check if any admin accounts exist in Firestore
  async function adminExistsInFirestore() {
    try {
      const q = query(collection(db, "users"), where("role", "==", "admin"));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error("Error checking for admin in Firestore:", error);
      return false;
    }
  }

  // Create admin account function that runs only once
  async function setupAdminAccount() {
    // Use module-level variable to ensure this runs only once across
    // component re-renders and even hot reloads
    if (adminSetupComplete) {
      return;
    }

    adminSetupComplete = true;

    const adminEmail = "vertexcampusmain@gmail.com";
    const adminPassword = "Vertex@#22";

    try {
      // First check if admin exists in Firestore
      const firestoreHasAdmin = await adminExistsInFirestore();

      if (firestoreHasAdmin) {
        console.log(
          "Admin account exists in Firestore. No need to create one."
        );
        return;
      }

      // Then check if admin exists in Authentication
      const authHasAdmin = await adminExistsInAuth(adminEmail);

      if (authHasAdmin) {
        // Admin exists in Auth but not in Firestore, try to sign in and create Firestore doc
        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            adminEmail,
            adminPassword
          );

          console.log(
            "Found existing admin in auth, creating Firestore document..."
          );

          await setDoc(doc(db, "users", userCredential.user.uid), {
            name: "System Administrator",
            email: adminEmail,
            role: "admin",
            emailVerified: true,
            createdAt: serverTimestamp(),
          });

          console.log(
            "Admin Firestore document created for existing auth account"
          );
          await signOut(auth);
        } catch (signInError) {
          console.error(
            "Could not sign in with existing admin account:",
            signInError
          );
        }
      } else {
        // Admin doesn't exist in either place, create a new account
        try {
          console.log("Creating new admin account...");

          const userCredential = await createUserWithEmailAndPassword(
            auth,
            adminEmail,
            adminPassword
          );

          await updateProfile(userCredential.user, {
            displayName: "System Administrator",
          });

          await setDoc(doc(db, "users", userCredential.user.uid), {
            name: "System Administrator",
            email: adminEmail,
            role: "admin",
            emailVerified: true,
            createdAt: serverTimestamp(),
          });

          console.log("Admin account created successfully");
          await signOut(auth);
        } catch (createError) {
          console.error("Failed to create admin account:", createError);
        }
      }
    } catch (error) {
      console.error("Admin setup failed:", error);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setUserData(null);
        setLoading(false);
      }
    });

    // Separate function call instead of directly in useEffect
    // This helps with better control flow
    setupAdminAccount().catch((err) => {
      console.error("Error in admin account setup:", err);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const userDocRef = doc(db, "users", currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        // Update the emailVerified field in Firestore if the user's email has been verified
        const userData = doc.data();
        if (currentUser.emailVerified && !userData.emailVerified) {
          // User has verified their email but Firestore hasn't been updated
          setDoc(userDocRef, { emailVerified: true }, { merge: true });
        }

        setUserData(doc.data());
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  const value = {
    currentUser,
    userData,
    signup,
    login,
    logout,
    loading,
    sendVerificationEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
