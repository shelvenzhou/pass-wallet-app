import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { useAccount } from 'wagmi';
import Navbar from '../components/Navbar';
import AccountList from '../components/AccountList';
import { useEffect } from 'react';


const Home: NextPage = () => {
  const { address, isConnected } = useAccount();



  return (
    <div className={styles.container}>
      <Head>
        <title>PASS Wallet</title>
        <meta name="description" content="Manage your PassWallet accounts" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        {!isConnected ? (
          <div className={styles.connectContainer}>
            <h1>Welcome to PassWallet</h1>
            <p>Connect your wallet to get started</p>
            <ConnectButton />
          </div>
        ) : (
          <div className={styles.welcomeContainer}>
            <h1>Welcome to PassWallet</h1>
            <p>Connected Account: {address}</p>
            <AccountList />
          </div>
        )}
      </main>

      <footer className={styles.footer}>
      </footer>
    </div>
  );
};

export default Home;